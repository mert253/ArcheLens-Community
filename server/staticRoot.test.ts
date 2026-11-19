// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveStaticRoot } from './staticRoot';

const roots: string[] = [];
function projectRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'archelens-static-root-'));
  roots.push(root);
  mkdirSync(path.join(root, 'dist'));
  writeFileSync(path.join(root, 'dist', 'index.html'), '<html>Built frontend</html>');
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src', 'index.html'), '<html>Source files</html>');
  writeFileSync(path.join(root, 'index.html'), '<html>Repo root</html>');
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('resolveStaticRoot', () => {
  it('rejects repository root even when it contains index.html', () => {
    const root = projectRoot();
    expect(() => resolveStaticRoot('.', root)).toThrow(/STATIC_DIR/);
    expect(() => resolveStaticRoot(root, root)).toThrow(/STATIC_DIR/);
  });
  it('rejects source directories', () => {
    const root = projectRoot();
    expect(() => resolveStaticRoot(path.join(root, 'src'), root)).toThrow(/STATIC_DIR/);
  });
  it('accepts only the built dist with a regular index.html', () => {
    const root = projectRoot();
    expect(resolveStaticRoot('dist', root)).toBe(path.join(root, 'dist'));
    expect(resolveStaticRoot(path.join(root, 'dist'), root)).toBe(path.join(root, 'dist'));
  });
  it('rejects a dist symlink pointing outside the application', () => {
    const root = projectRoot();
    const elsewhere = mkdtempSync(path.join(tmpdir(), 'archelens-external-'));
    roots.push(elsewhere);
    writeFileSync(path.join(elsewhere, 'index.html'), '<html>External</html>');
    rmSync(path.join(root, 'dist'), { recursive: true });
    symlinkSync(elsewhere, path.join(root, 'dist'), 'dir');
    expect(() => resolveStaticRoot('dist', root)).toThrow(/STATIC_DIR/);
  });
  it('rejects a missing or non-file entrypoint', () => {
    const root = projectRoot();
    rmSync(path.join(root, 'dist', 'index.html'));
    expect(() => resolveStaticRoot('dist', root)).toThrow(/STATIC_DIR/);
    mkdirSync(path.join(root, 'dist', 'index.html'));
    expect(() => resolveStaticRoot('dist', root)).toThrow(/STATIC_DIR/);
  });
});
