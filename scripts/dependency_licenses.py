"""Regenerate the installed dependency inventory and retain available license/NOTICE texts."""
from pathlib import Path
import json, re

root = Path(__file__).resolve().parent.parent
out = root / 'third_party/licenses'
out.mkdir(parents=True, exist_ok=True)
rows = []
seen = set()
packages=[]
for base in [root, root/'supabase/tests']:
    lock = json.loads((base/'package-lock.json').read_text(encoding='utf-8'))
    packages.extend((base, rel, entry) for rel, entry in sorted(lock['packages'].items()))
for base, rel, entry in packages:
    if not rel or not rel.startswith('node_modules/'): continue
    directory = base / rel
    manifest = directory / 'package.json'
    if not manifest.exists(): continue  # Platform-specific optional package is not installed.
    package = json.loads(manifest.read_text(encoding='utf-8'))
    name, version = package.get('name', rel), package.get('version', entry.get('version', 'unknown'))
    if (name, version) in seen: continue
    seen.add((name, version))
    texts=[]
    for file in sorted(directory.iterdir()):
        if not file.is_file() or not re.match(r'^(licen[cs]e|copying|notice)([._-].*)?$', file.name, re.I): continue
        # The inventory contains upstream license prose, never maintainer home paths.
        safe = re.sub(r'[^A-Za-z0-9._-]', '_', name) + '-' + version + '-' + file.name
        target=out/safe
        target.write_bytes(file.read_bytes())
        texts.append('third_party/licenses/' + safe)
    declared = package.get('license') or entry.get('license')
    if not declared and package.get('licenses'):
        declared = ' OR '.join(item.get('type', 'UNKNOWN') for item in package['licenses'])
    if not declared and name == 'webgl-constants' and (directory/'LICENSE').exists():
        declared = 'MIT (LICENSE text reviewed)'
    rows.append({'name': name, 'version': version, 'license': declared or 'UNKNOWN', 'development': bool(entry.get('dev')), 'licenseTexts': texts})
(root/'third_party/dependencies.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
unknown=[x['name'] for x in rows if x['license']=='UNKNOWN']
summary='# Third-party notices\n\nThis inventory covers installed dependencies from the application and SQL test harness npm lockfiles. Dependencies retain their own licenses. Available license and NOTICE texts are retained in [third_party/licenses](third_party/licenses); exact names, versions, declared licenses and text paths are listed in [dependencies.json](third_party/dependencies.json).\n\nRegenerate with `python scripts/dependency_licenses.py` after `npm ci` and `npm ci --prefix supabase/tests`. Platform-specific optional packages not installed on the generator host are omitted; inspect their package/license before distributing that platform build.\n\nThis metadata/text collection is not a legal clearance: inspect bundled subcomponents and upstream attribution requirements, especially OpenCV/WASM and XR assets. Remote model weights, fonts, maps, HDR environments and catalogue content are not licensed by the application.\n\n'
summary+=f'Installed unique packages reviewed: {len(rows)}. Missing declared license: {len(unknown)}.\n\n'
summary+='| Package | Version | Declared license |\n| --- | --- | --- |\n'
for row in rows:
    summary+=f"| {row['name']} | {row['version']} | {row['license']} |\n"
(root/'THIRD_PARTY_NOTICES.md').write_text(summary,encoding='utf-8')
combined = 'ArcheLens Open Source — third-party license and attribution texts\n\n' + summary
for file in sorted(out.iterdir()):
    if file.is_file():
        combined += '\n\n===== ' + file.name + ' =====\n\n' + file.read_text(encoding='utf-8', errors='replace')
(root/'public/third-party-licenses.txt').write_text(combined,encoding='utf-8')
print(json.dumps({'packages':len(rows),'unknownLicenseCount':len(unknown),'unknownPackages':unknown}))
