import fs from 'node:fs';
import path from 'node:path';

/**
 * Only the bundled frontend in <applicationRoot>/dist may be served.
 * An invalid path fails at startup, before Express binds a listener.
 */
export function resolveStaticRoot(staticDir: string, applicationRoot: string = process.cwd()): string {
  const invalid = (): never => { throw new Error('STATIC_DIR must point to the built dist frontend directory'); };
  try {
    const root = fs.realpathSync(applicationRoot);
    const expected = path.join(root, 'dist');
    const requested = path.resolve(root, staticDir);
    if (requested !== expected) return invalid();
    if (!fs.lstatSync(requested).isDirectory()) return invalid();
    if (fs.realpathSync(requested) !== fs.realpathSync(expected)) return invalid();
    const entry = path.join(requested, 'index.html');
    if (!fs.lstatSync(entry).isFile()) return invalid();
    return requested;
  } catch {
    return invalid();
  }
}
