"""Synthetic stdlib checks; run: python -B -m unittest discover -s scripts -p test_scan_secrets.py"""
from __future__ import annotations

import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("scan_secrets", Path(__file__).with_name("scan_secrets.py"))
scanner = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(scanner)


def shaped_key() -> str:
    # No complete provider-key-shaped literal is stored in the repository.
    return "AIza" + "Q" * 35


def assignment(name: str, value: str) -> str:
    return name + " = " + json.dumps(value) + "\n"


def jwt(role: str) -> str:
    def segment(data):
        return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")
    return ".".join([segment({"alg": "HS256", "typ": "JWT"}), segment({"role": role}), "Q" * 43])


class PatternTests(unittest.TestCase):
    def test_complete_provider_format_is_blocking_and_redacted(self):
        value = shaped_key()
        findings = scanner.text_findings(value)
        self.assertTrue(any(f["type"] == "gemini_api_key" and f["blocking"] for f in findings))
        self.assertTrue(value not in json.dumps(findings), "Credential output must be redacted.")

    def test_both_supabase_jwt_roles_are_blocking(self):
        for role in ["anon", "service_role"]:
            with self.subTest(role=role):
                findings = scanner.text_findings(jwt(role))
                self.assertTrue(any(f["type"].endswith("jwt") and f["blocking"] for f in findings))

    def test_allowed_trailing_hyphen_is_not_a_word_boundary_bypass(self):
        values = ["AIza" + "Q" * 34 + "-", "sb_" + "secret_" + "Q" * 24 + "-", "sk-" + "Q" * 24 + "-", jwt("anon")[:-1] + "-"]
        for value in values:
            self.assertTrue(scanner.text_findings(value))

    def test_supabase_and_polycam_literals(self):
        prefix = "sb_" + "secret_"
        self.assertTrue(any(f["type"] == "supabase_key" for f in scanner.text_findings(prefix + "Q" * 30)))
        text = assignment("POLYCAM" + "_API_KEY", "opaque-production-looking-value")
        self.assertTrue(any(f["type"] == "polycam_credential_literal" for f in scanner.text_findings(text)))

    def test_generic_literals_but_not_code_references(self):
        text = assignment("CUSTOM" + "_API_KEY", "opaque-production-looking-value")
        self.assertTrue(any(f["type"] == "credential_literal" for f in scanner.text_findings(text)))
        for source in ["serviceKey = serviceKey || store.get('stored_key');", "API_KEY = configValue", "SECRET_NAME = re.compile(r'pattern')"]:
            self.assertFalse(scanner.text_findings(source))

    def test_empty_env_does_not_consume_next_line(self):
        self.assertFalse(scanner.text_findings("CUSTOM_API_KEY=\nMODEL=ordinary-model-name\n", environment=True))

    def test_interpolation_is_not_a_blanket_password_exception(self):
        name = "CUSTOM" + "_PASSWORD"
        value = "opaque${literal}password"
        self.assertTrue(scanner.text_findings(assignment(name, value)))
        self.assertFalse(scanner.text_findings(name + " = `prefix${runtime.value}`"))

    def test_explicit_invalid_examples_are_allowed(self):
        for value in ["", "your_api_key_here", "example-invalid-key", "<enter a local key>"]:
            self.assertFalse(scanner.text_findings(assignment("CUSTOM" + "_API_KEY", value)))
        # An actual provider format is still flagged, regardless of repeated characters.
        self.assertTrue(scanner.text_findings(assignment("GEMINI" + "_API_KEY", shaped_key())))

    def test_invalid_gemini_fixture_label_is_not_a_provider_key(self):
        self.assertFalse(scanner.text_findings(assignment("GEMINI" + "_API_KEY", "server-test-only")))

    def test_authorization_examples_and_short_role_labels(self):
        for value in ["Bearer reader", "Bearer example-invalid-token"]:
            self.assertFalse(scanner.text_findings(assignment("Authorization", value)))

    def test_privacy_is_optional_and_nonblocking(self):
        text = "maintainer@example.invalid\nlatitude: 12.345\n"
        self.assertFalse(scanner.text_findings(text))
        findings = scanner.text_findings(text, privacy=True)
        self.assertTrue(findings)
        self.assertTrue(all(not f["blocking"] for f in findings))


class RepositoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "repository"
        self.root.mkdir()
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.name", "Synthetic Scanner Fixture")
        self.git("config", "user.email", "scanner@example.invalid")

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args, data=None):
        result = subprocess.run(["git", "-C", str(self.root), *args], input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.assertEqual(result.returncode, 0, "A synthetic Git fixture command failed; output withheld.")
        return result.stdout.decode().strip()

    def write(self, relative, text):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def baseline(self):
        self.write("README.md", "Synthetic test repository.\n")
        self.git("add", "README.md")
        self.git("commit", "-q", "-m", "Initial clean fixture")

    def test_untracked_nonignored_file_is_scanned(self):
        self.write("unexpected/new-file.txt", shaped_key())
        report = scanner.run(self.root, "worktree")
        self.assertGreater(report["blocking_count"], 0)

    def test_ignored_local_files_are_excluded_but_tracked_ignored_are_included(self):
        self.write(".gitignore", "ignored.txt\nnode_modules/\n.env\n")
        self.write("ignored.txt", shaped_key())
        self.write("node_modules/local.txt", shaped_key())
        self.write(".env", shaped_key())
        self.assertEqual(scanner.run(self.root, "worktree")["blocking_count"], 0)
        self.git("add", "-f", "ignored.txt")
        report = scanner.run(self.root, "worktree")
        self.assertGreater(report["blocking_count"], 0)
        self.assertTrue(any("ignored.txt" in f.get("paths", []) for f in report["findings"]))

    def test_staged_secret_is_not_hidden_by_clean_worktree(self):
        path = self.write("settings.txt", shaped_key())
        self.git("add", "settings.txt")
        path.write_text("Clean working copy.\n", encoding="utf-8")
        report = scanner.run(self.root, "worktree")
        self.assertTrue(any(f["scope"] == "index_blob" and f["blocking"] for f in report["findings"]))

    def test_empty_real_env_is_blocked_but_safe_example_is_allowed(self):
        self.write(".gitignore", ".env\n")
        self.write(".env.example", "CUSTOM_API_KEY=\n")
        self.assertEqual(scanner.run(self.root, "worktree")["blocking_count"], 0)
        self.write(".env", "")
        self.git("add", "-f", ".env")
        self.assertTrue(any(f["type"] == "environment_file" for f in scanner.run(self.root, "worktree")["findings"]))

    def test_binary_and_database_files_are_blocking_not_silently_skipped(self):
        path = self.root / "assets" / "unknown.bin"
        path.parent.mkdir()
        path.write_bytes(b"\x89PNG\x00\xff")
        self.write("data/backup.sql", "-- PostgreSQL database dump\n")
        report = scanner.run(self.root, "worktree")
        self.assertTrue(any(f["type"] == "opaque_binary_review" for f in report["findings"]))
        self.assertTrue(any(f["type"].startswith("database_") for f in report["findings"]))

    def test_utf16_with_nul_is_opaque(self):
        (self.root / "opaque.txt").write_bytes("text\x00hidden".encode("utf-16"))
        report = scanner.run(self.root, "worktree")
        self.assertTrue(any(f["type"] == "opaque_binary_review" for f in report["findings"]))

    def test_empty_history_is_reported_honestly(self):
        report = scanner.run(self.root, "history")
        self.assertEqual(report["scope"]["commits"], 0)
        self.assertEqual(report["scope"]["refs"], 0)
        self.assertIsNone(report["scope"]["head"])

    def test_other_ref_and_deleted_file_remain_in_history(self):
        self.baseline()
        self.git("checkout", "-q", "-b", "old-fixture")
        self.write("old/removed.txt", shaped_key())
        self.git("add", "old/removed.txt")
        self.git("commit", "-q", "-m", "Synthetic historical fixture")
        self.git("rm", "-q", "old/removed.txt")
        self.git("commit", "-q", "-m", "Remove fixture from tree")
        self.git("checkout", "-q", "main")
        self.assertEqual(scanner.run(self.root, "worktree")["blocking_count"], 0)
        report = scanner.run(self.root, "history")
        self.assertEqual(report["scope"]["refs"], 2)
        self.assertEqual(report["scope"]["commits"], 3)
        self.assertTrue(any("old/removed.txt" in f.get("paths", []) for f in report["findings"]))

    def test_commit_and_annotated_tag_messages_are_scanned(self):
        self.baseline()
        self.git("commit", "-q", "--allow-empty", "-m", shaped_key())
        self.git("tag", "-a", "synthetic-tag", "-m", shaped_key())
        report = scanner.run(self.root, "history")
        hits = [f for f in report["findings"] if f["scope"] == "history_metadata" and f["blocking"]]
        self.assertTrue(any("/commit/" in f["path"] for f in hits))
        self.assertTrue(any("/tag/" in f["path"] for f in hits))

    def test_git_replace_cannot_hide_original_history(self):
        self.write("historical.txt", shaped_key())
        self.git("add", "historical.txt")
        self.git("commit", "-q", "-m", "Synthetic original")
        original = self.git("rev-parse", "HEAD")
        empty_tree = self.git("mktree", data=b"")
        replacement = self.git("commit-tree", empty_tree, "-m", "Independent clean replacement")
        self.git("replace", original, replacement)
        report = scanner.run(self.root, "history")
        self.assertTrue(any(f["type"] == "gemini_api_key" for f in report["findings"]))

    def test_direct_tree_ref_preserves_filename_checks(self):
        self.write(".env", "")
        self.git("add", ".env")
        tree = self.git("write-tree")
        self.git("update-ref", "refs/snapshots/synthetic-tree", tree)
        report = scanner.run(self.root, "history")
        self.assertEqual(report["scope"]["commits"], 0)
        self.assertTrue(any(f["type"] == "environment_file" for f in report["findings"]))

    def test_filename_and_cli_json_output_are_redacted(self):
        value = shaped_key()
        self.write(value + ".txt", value)
        output = io.StringIO()
        report_path = Path(self.temp.name) / "report.json"
        with contextlib.redirect_stdout(output):
            status = scanner.main([str(self.root), "--json", str(report_path)])
        self.assertEqual(status, 1)
        self.assertTrue(value not in output.getvalue(), "Console output must be redacted.")
        self.assertTrue(value not in report_path.read_text(encoding="utf-8"), "JSON output must be redacted.")

    def test_generic_assignment_in_filename_is_redacted(self):
        value = "opaque-production-looking-value"
        name = "CUSTOM_API_KEY='" + value + "'.txt"
        self.write(name, "Harmless file content.\n")
        report = scanner.run(self.root, "worktree")
        self.assertGreater(report["blocking_count"], 0)
        self.assertTrue(value not in json.dumps(report), "Filename output must be redacted.")

    def test_invalid_cli_arguments_do_not_echo_values(self):
        value = shaped_key()
        output = io.StringIO()
        with contextlib.redirect_stderr(output), self.assertRaises(SystemExit) as error:
            scanner.main(["--unexpected", value])
        self.assertEqual(error.exception.code, 2)
        self.assertTrue(value not in output.getvalue(), "Invalid arguments must not be echoed.")

    def test_nested_root_does_not_silently_omit_files(self):
        nested = self.root / "nested"
        nested.mkdir()
        with contextlib.redirect_stderr(io.StringIO()):
            status = scanner.main([str(nested)])
        self.assertEqual(status, 2)


if __name__ == "__main__":
    unittest.main()
