#!/usr/bin/env python3
"""Offline, redacted credential checks for this Git repository (Python stdlib).

    python scripts/scan_secrets.py . --mode worktree
    python scripts/scan_secrets.py . --mode history --privacy --json report.json

Worktree mode scans tracked files (including tracked ignored files) and all
nonignored untracked files, using Git's own ignore rules. It never scans an
ignored local .env unless it has been tracked. Staged blob contents are also
checked, so overwriting a staged secret does not hide it. History mode scans every object
reachable from every local ref and HEAD, including commit/tag messages. Fetch
the intended remote refs first: this tool does not fetch or use credentials.

Exit 0: no blocking findings; 1: a credential/artifact/opaque-content candidate;
2: an incomplete scan or usage error. --privacy adds nonblocking review counts.
Reports contain locations and categories, never matched values or excerpts.

Limits: patterns cannot prove the absence of unknown, split, encrypted or
obfuscated secrets. Opaque binary files are blocking review findings because
their full contents cannot be assessed as text. No network validation, OCR,
archive extraction, dependency downloads or source/history mutation occurs.
This is a guardrail, not a replacement for provider revocation and review.
"""
from __future__ import annotations

import argparse
import base64
from collections import Counter, defaultdict
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Any


TOKEN_RULES = [
    ("gemini_api_key", re.compile(r"(?<![0-9A-Za-z_-])AIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])")),
    ("openai_api_key", re.compile(r"(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])")),
    ("anthropic_api_key", re.compile(r"(?<![A-Za-z0-9_-])sk-ant-[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])")),
    ("github_token", re.compile(r"(?<![A-Za-z0-9_-])(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})(?![A-Za-z0-9_-])")),
    ("supabase_key", re.compile(r"(?<![A-Za-z0-9_-])sb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])")),
    ("aws_access_key", re.compile(r"(?<![A-Za-z0-9_])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9_])")),
    ("provider_token", re.compile(r"(?<![A-Za-z0-9_-])(?:hf_[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{20,}|r8_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{15,}|glpat-[A-Za-z0-9_-]{20,})(?![A-Za-z0-9_-])")),
    ("private_key", re.compile(r"-----BEGIN (?:(?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY|PGP PRIVATE KEY BLOCK)-----")),
    ("credential_in_url", re.compile(r"\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^\s/@:]+:[^\s/@]+@")),
]
JWT_PATTERN = re.compile(r"(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_-])")
ASSIGNMENT = re.compile(
    r"(?i)(?<![\w-])[\"']?([A-Za-z_][A-Za-z0-9_.-]*)[\"']?\s*[:=]\s*([\"'`])([^\"'`\r\n]*)\2"
)
BARE_ENV = re.compile(r"(?m)^[ \t]*([A-Z_][A-Z0-9_]*)[ \t]*=[ \t]*([^\s#\"'`()]+)[ \t]*(?:\#.*)?$")
SECRET_NAME = re.compile(r"(?i)(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|authorization|password|passwd|secret|service[_-]?key|anon[_-]?key|polycam[_-]?key|private[_-]?key)")
AUTH = re.compile(r"(?i)\b(?:Bearer|Basic|ApiKey)\s+([A-Za-z0-9_.+/=-]{12,})")
EMAIL = re.compile(r"(?i)(?<![\w.+-])[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}(?![\w.-])")
USER_PATH = re.compile(r"(?i)(?:\b[A-Z]:[\\/]+Users[\\/]+[^\\/\s\"'<>]+|(?<!\w)/(?:home|Users)/[^/\s\"'<>]+)")
COORDINATE = re.compile(r"(?i)\b(?:lat(?:itude)?|lon(?:gitude)?|lng)\s*[\"']?\s*[:=]\s*[-+]?\d{1,3}\.\d{2,}")
SAFE_EXAMPLES = {
    "", "your_api_key_here", "your-api-key-here", "your_key_here", "your-key-here",
    "your_token_here", "your-token-here", "replace_me", "replace-me", "changeme",
    "change_me", "change-me", "example-invalid-key", "example-invalid-token",
    "example-invalid-password", "example-invalid-secret", "invalid-example-key",
    "invalid-example-token", "test-key", "test-token", "test-secret", "mock-key",
    "dummy-key", "dummy-token", "placeholder", "redacted", "undefined", "null",
}


class ScanError(Exception):
    """Error details deliberately exclude command output and file contents."""


class RedactedArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        self.print_usage(sys.stderr)
        self.exit(2, "Invalid scanner arguments; details withheld to prevent disclosure.\n")


def git(root: Path, *args: str, optional: bool = False) -> bytes:
    result = subprocess.run(["git", "--no-replace-objects", "-C", str(root), *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode and not optional:
        raise ScanError("A required Git read failed; diagnostic output was withheld.")
    return result.stdout if result.returncode == 0 else b""


def safe_location(value: str) -> str:
    """A hostile file/ref name must not disclose a recognized token or PII."""
    for _, pattern in TOKEN_RULES:
        value = pattern.sub("<credential-redacted>", value)
    value = JWT_PATTERN.sub("<credential-redacted>", value)
    value = EMAIL.sub("<personal-value-redacted>", value)
    value = USER_PATH.sub("<personal-value-redacted>", value)
    value = ASSIGNMENT.sub(lambda match: match.group(1) + "=<credential-redacted>" if SECRET_NAME.search(match.group(1)) else match.group(), value)
    value = BARE_ENV.sub(lambda match: match.group(1) + "=<credential-redacted>" if SECRET_NAME.search(match.group(1)) else match.group(), value)
    value = AUTH.sub("authorization <credential-redacted>", value)
    return value.replace("\n", "<newline>").replace("\r", "<return>")


def is_example_or_expression(value: str) -> bool:
    """Only explicit invalid examples/expressions; no broad 'test' exemptions."""
    stripped = value.strip()
    if stripped.lower() in SAFE_EXAMPLES:
        return True
    if re.fullmatch(r"<[^<>\r\n]+>", stripped):
        return True
    if re.fullmatch(r"(?:process\.env|import\.meta\.env)\.[A-Za-z_][A-Za-z0-9_]*", stripped):
        return True
    return bool(re.fullmatch(r"\$\{[A-Za-z_][A-Za-z0-9_.]*\}", stripped))


def text_findings(text: str, privacy: bool = False, environment: bool = False) -> list[dict[str, Any]]:
    from bisect import bisect_right
    starts = [0] + [m.end() for m in re.finditer("\n", text)]
    hits = Counter()
    def add(offset: int, kind: str, blocking: bool = True):
        hits[(bisect_right(starts, offset), kind, blocking)] += 1
    # Complete provider formats are never exempted by placeholder-looking text.
    for kind, pattern in TOKEN_RULES:
        for match in pattern.finditer(text):
            if kind == "credential_in_url":
                credentials = match.group().split("://", 1)[1].rsplit("@", 1)[0]
                username, _, password = credentials.partition(":")
                if all(re.fullmatch(r"\$\{[A-Za-z_][A-Za-z0-9_.]*\}", part) for part in [username, password]):
                    continue
            add(match.start(), kind)
    for match in JWT_PATTERN.finditer(text):
        try:
            header, payload, _ = match.group().split(".")
            decode = lambda part: json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
            if not isinstance(decode(header), dict) or not isinstance(decode(payload), dict):
                continue
            role = decode(payload).get("role")
        except (ValueError, UnicodeDecodeError):
            continue
        kind = "supabase_privileged_jwt" if role == "service_role" else "supabase_anon_jwt" if role == "anon" else "jwt_token"
        add(match.start(), kind)
    for match in ASSIGNMENT.finditer(text):
        name, quote, value = match.groups()
        if not SECRET_NAME.search(name):
            continue
        # Gemini/Google API keys have a defined format already checked above;
        # ordinary test/model labels are not valid credentials for that provider.
        normalized = re.sub(r"[^a-z0-9]", "", name.lower())
        if normalized.endswith(("geminiapikey", "googleapikey")):
            continue
        if quote == "`" and "${" in value:
            continue  # JavaScript template expression; static provider tokens above still block.
        if "authorization" in name.lower():
            value = re.sub(r"(?i)^(?:Bearer|Basic|ApiKey)\s+", "", value)
            if len(value) < 12:
                continue
        if len(value) >= 6 and not is_example_or_expression(value):
            add(match.start(), "polycam_credential_literal" if "polycam" in name.lower() else "credential_literal")
    for match in BARE_ENV.finditer(text):
        name, value = match.groups()
        # Bare source identifiers are references; dotenv files are blocked separately.
        variable_reference = not environment and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value)
        if SECRET_NAME.search(name) and len(value) >= 6 and not variable_reference and not is_example_or_expression(value):
            add(match.start(), "credential_literal")
    for match in AUTH.finditer(text):
        if not is_example_or_expression(match.group(1)):
            add(match.start(), "authorization_credential")
    if privacy:
        for kind, pattern in [("email_review", EMAIL), ("user_path_review", USER_PATH), ("coordinate_review", COORDINATE)]:
            for match in pattern.finditer(text):
                add(match.start(), kind, False)
    return [{"line": line, "type": kind, "blocking": blocking, "count": count, "value": "<redacted>"}
            for (line, kind, blocking), count in sorted(hits.items())]


def decode_text(raw: bytes) -> tuple[str, bool]:
    try:
        if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
            text = raw.decode("utf-16")
            return text, "\x00" in text
        text = raw.decode("utf-8-sig")
        return text, "\x00" in text
    except UnicodeError:
        return raw.decode("latin-1"), True


def artifact_kind(path: str, text: str) -> str | None:
    name = Path(path).name.lower()
    if (name == ".env" or name.startswith(".env.")) and name != ".env.example":
        return "environment_file"
    if re.search(r"(?i)(?:\.(?:sqlite3?|db|dump|bak)(?:-(?:wal|shm|journal))?|(?:^|/)(?:dump|backup)[^/]*\.sql)$", path):
        return "database_or_dump_file"
    if re.search(r"(?im)^--\s*(?:PostgreSQL database dump|MySQL dump)\b|^COPY\s+.+\s+FROM\s+stdin;", text):
        return "database_dump_content"
    return None


def scan_data(raw: bytes, paths: list[str], privacy: bool) -> tuple[list[dict], bool]:
    text, opaque = decode_text(raw)
    environment = any(Path(path).name.lower().startswith(".env") for path in paths)
    findings = text_findings(text, privacy, environment)
    for path in paths:
        for hit in text_findings(path, privacy):
            findings.append({**hit, "line": None, "type": hit["type"] + "_in_path", "path": safe_location(path)})
        kind = artifact_kind(path, text)
        if kind:
            findings.append({"line": 1, "type": kind, "blocking": True, "count": 1,
                             "path": safe_location(path), "value": "<redacted>"})
    if opaque:
        findings.append({"line": None, "type": "opaque_binary_review", "blocking": True, "count": 1, "value": "<redacted>"})
    if raw.startswith(b"version https://git-lfs.github.com/spec/v1\n"):
        findings.append({"line": 1, "type": "unscanned_lfs_content", "blocking": True, "count": 1, "value": "<redacted>"})
    return findings, opaque


def read_objects(root: Path, ids: set[str]) -> dict[str, tuple[str, bytes]]:
    if not ids:
        return {}
    process = subprocess.Popen(["git", "--no-replace-objects", "-C", str(root), "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert process.stdin and process.stdout
    result = {}
    try:
        for oid in sorted(ids):
            process.stdin.write((oid + "\n").encode()); process.stdin.flush()
            response = process.stdout.readline().split()
            if len(response) != 3:
                raise ScanError("An expected Git object is unavailable; scan is incomplete.")
            _, kind, length = response
            raw = process.stdout.read(int(length))
            if len(raw) != int(length) or process.stdout.read(1) != b"\n":
                raise ScanError("A Git object read was incomplete.")
            result[oid] = (kind.decode(), raw)
        process.stdin.close()
        process.wait(timeout=30)
        if process.returncode:
            raise ScanError("Git object reading failed; scan is incomplete.")
    finally:
        if process.poll() is None:
            process.kill(); process.wait()
        for stream in [process.stdin, process.stdout, process.stderr]:
            if stream and not stream.closed:
                stream.close()
    return result


def scan_worktree(root: Path, privacy: bool) -> tuple[list[dict], dict]:
    listed = git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
    paths = sorted({p.decode("utf-8", "surrogateescape") for p in listed.split(b"\x00") if p})
    tracked = {p for p in git(root, "ls-files", "-z", "--cached").split(b"\x00") if p}
    findings = []
    files = byte_count = opaque_count = missing = 0
    for relative in paths:
        path = root / relative
        if path.is_symlink():
            raw = os.readlink(path).encode("utf-8", "surrogateescape")
        elif path.is_file():
            raw = path.read_bytes()
        elif not path.exists():
            missing += 1  # Deleted worktree files are still checked in history mode.
            continue
        else:
            findings.append({"scope": "worktree", "path": safe_location(relative), "line": None,
                             "type": "unscanned_nonregular_entry", "blocking": True, "count": 1, "value": "<redacted>"})
            continue
        files += 1; byte_count += len(raw)
        hits, opaque = scan_data(raw, [relative], privacy)
        opaque_count += int(opaque)
        findings.extend({"scope": "worktree", "path": safe_location(relative), **hit} for hit in hits)
    indexed_paths = defaultdict(set)
    for entry in git(root, "ls-files", "-z", "--stage").split(b"\x00"):
        if not entry:
            continue
        metadata, path = entry.split(b"\t", 1)
        mode, oid, stage = metadata.split()
        if mode == b"160000":
            findings.append({"scope": "index", "path": safe_location(path.decode("utf-8", "surrogateescape")), "line": None,
                             "type": "unscanned_submodule", "blocking": True, "count": 1, "value": "<redacted>"})
        else:
            indexed_paths[oid.decode()].add(path.decode("utf-8", "surrogateescape"))
    indexed_objects = read_objects(root, set(indexed_paths))
    for oid, (kind, raw) in indexed_objects.items():
        if kind != "blob":
            raise ScanError("An index entry is not an available blob; scan is incomplete.")
        indexed_names = sorted(indexed_paths[oid])
        hits, _ = scan_data(raw, indexed_names, privacy)
        findings.extend({"scope": "index_blob", "object": oid, "paths": [safe_location(p) for p in indexed_names], **hit} for hit in hits)
    return findings, {"selected_paths": len(paths), "tracked_paths": len(tracked), "files_scanned": files,
                      "bytes_scanned": byte_count, "opaque_files": opaque_count, "deleted_worktree_paths": missing,
                      "indexed_blobs_scanned": len(indexed_objects),
                      "selection": "all tracked plus nonignored untracked files and staged blobs; tracked ignored files included"}


def scan_history(root: Path, privacy: bool) -> tuple[list[dict], dict]:
    refs = git(root, "for-each-ref", "--format=%(refname)").decode("utf-8", "replace").splitlines()
    head = git(root, "rev-parse", "--verify", "HEAD", optional=True).decode().strip() or None
    lines = git(root, "rev-list", "--objects", "--all").splitlines()
    if head:
        lines += git(root, "rev-list", "--objects", "HEAD").splitlines()
    ids = {line.split(b" ", 1)[0].decode() for line in lines}
    objects = read_objects(root, ids)
    hash_bytes = 32 if git(root, "rev-parse", "--show-object-format").strip() == b"sha256" else 20
    paths_by_blob = defaultdict(set)
    root_trees = set()
    for kind, raw in objects.values():
        if kind == "commit":
            match = re.match(rb"tree ([a-f0-9]+)\n", raw)
            if match:
                root_trees.add(match.group(1).decode())
    # Tree refs are also valid; include them even without a commit.
    for ref in refs:
        oid = git(root, "rev-parse", ref + "^{}").decode().strip()
        if oid in objects and objects[oid][0] == "tree":
            root_trees.add(oid)
    findings = []
    def walk(tree: str, prefix: str = ""):
        if tree not in objects:
            raise ScanError("A reachable tree is unavailable; scan is incomplete.")
        raw = objects[tree][1]
        position = 0
        while position < len(raw):
            space = raw.index(b" ", position); end = raw.index(b"\x00", space)
            mode = raw[position:space]
            name = raw[space+1:end].decode("utf-8", "surrogateescape")
            oid = raw[end+1:end+1+hash_bytes].hex(); position = end+1+hash_bytes
            path = prefix + name
            if mode == b"40000":
                walk(oid, path + "/")
            elif mode == b"160000":
                findings.append({"scope": "history", "path": safe_location(path), "line": None,
                                 "type": "unscanned_submodule", "blocking": True, "count": 1, "value": "<redacted>"})
            else:
                paths_by_blob[oid].add(path)
    for tree in root_trees:
        walk(tree)
    counts = Counter(kind for kind, _ in objects.values())
    opaque_count = blob_bytes = 0
    for oid, (kind, raw) in objects.items():
        if kind == "blob":
            paths = sorted(paths_by_blob.get(oid, {f"@git/blob/{oid}"}))
            hits, opaque = scan_data(raw, paths, privacy)
            blob_bytes += len(raw); opaque_count += int(opaque)
            findings.extend({"scope": "history_blob", "object": oid, "paths": [safe_location(p) for p in paths], **hit} for hit in hits)
        elif kind in {"commit", "tag"}:
            text = raw.decode("utf-8", "replace")
            findings.extend({"scope": "history_metadata", "path": f"@git/{kind}/{oid}", **hit} for hit in text_findings(text, privacy))
            if privacy:
                for line, value in enumerate(text.partition("\n\n")[0].splitlines(), 1):
                    if value.startswith(("author ", "committer ", "tagger ")):
                        findings.append({"scope": "history_metadata", "path": f"@git/{kind}/{oid}", "line": line,
                                         "type": "contributor_identity_review", "blocking": False, "count": 1, "value": "<redacted>"})
    for number, ref in enumerate(refs, 1):
        findings.extend({"scope": "history_ref", "path": f"@git/ref/{number}", **hit} for hit in text_findings(ref, privacy))
    return findings, {"refs": len(refs), "head": head, "commits": counts["commit"], "tags": counts["tag"],
                      "trees": counts["tree"], "unique_blobs": counts["blob"], "reachable_objects": len(objects),
                      "blob_bytes_scanned": blob_bytes, "opaque_blobs": opaque_count,
                      "selection": "every object reachable from every local ref plus HEAD; no remote fetch performed"}


def run(root: Path, mode: str, privacy: bool = False) -> dict:
    root = root.resolve()
    top = git(root, "rev-parse", "--show-toplevel").decode("utf-8", "surrogateescape").strip()
    if Path(top).resolve() != root:
        raise ScanError("Pass the repository root so no tracked files are omitted.")
    findings, scope = scan_worktree(root, privacy) if mode == "worktree" else scan_history(root, privacy)
    blocking = sum(f["count"] for f in findings if f["blocking"])
    review = sum(f["count"] for f in findings if not f["blocking"])
    kinds = Counter()
    for finding in findings:
        kinds[finding["type"]] += finding["count"]
    return {"schema_version": 1, "mode": mode, "scope": scope, "blocking_count": blocking,
            "privacy_review_count": review, "findings_by_type": dict(sorted(kinds.items())),
            "findings": findings, "redaction": "Values and excerpts are never retained.",
            "limitations": ["Heuristic patterns cannot guarantee absence of unknown, split, encrypted or obfuscated credentials.",
                            "Opaque binary content is reported as blocking review; no archives or external symlink targets are decoded.",
                            "History includes only refs present locally. External forks, clones, caches, LFS storage and unfetched refs are outside scope.",
                            "No credentials are tested against a network service. Privacy matches are optional nonblocking review signals."]}


def main(argv: list[str] | None = None) -> int:
    parser = RedactedArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", type=Path, default=Path("."))
    parser.add_argument("--mode", choices=["worktree", "history"], default="worktree")
    parser.add_argument("--privacy", action="store_true", help="Include nonblocking privacy review findings.")
    parser.add_argument("--json", type=Path, dest="json_path", help="Write a report containing redacted locations/categories only.")
    args = parser.parse_args(argv)
    try:
        report = run(args.root, args.mode, args.privacy)
        if args.json_path:
            args.json_path.parent.mkdir(parents=True, exist_ok=True)
            args.json_path.write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    except (ScanError, OSError, ValueError, subprocess.SubprocessError):
        print("Secret scan incomplete: a Git or filesystem read failed. Details withheld to prevent disclosure.", file=sys.stderr)
        return 2
    print(f"Secret scan ({args.mode}): {report['blocking_count']} blocking candidate(s); {report['privacy_review_count']} optional privacy review signal(s).")
    print("Scope: " + json.dumps(report["scope"], sort_keys=True))
    for kind, count in report["findings_by_type"].items():
        print(f"  {kind}: {count}")
    for finding in report["findings"]:
        if finding["blocking"]:
            location = finding.get("path") or ", ".join(finding.get("paths", []))
            line = f":{finding['line']}" if finding.get("line") else ""
            print(f"  {location}{line}: {finding['type']} (<redacted>)")
    return 1 if report["blocking_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
