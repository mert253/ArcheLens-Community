# Installation and deployment

## Prerequisites

- Node.js 24 LTS recommended, minimum 22.12; npm and Git.
- Python 3.10+ for the repository credential scanner.
- A modern browser. WebGPU is required for local language models; WebGL is required for 3D features.
- Optional accounts: Gemini for cloud AI, Supabase for shared authentication/database features, Polycam for experimental photogrammetry.

Install with `npm ci`, copy `.env.example` to `.env.local`, then run `npm run dev:all`. Vite listens on loopback port 3000 and proxies `/api` to Express on port 3002. Both processes must be running. Set provider keys through the server environment.

Keep the development server bound to `127.0.0.1`. For production, serve the compiled `dist` files through the Express server.

## Trusted local mode

Set `AUTH_MODE=local` and `HOST=127.0.0.1`. Add `GEMINI_API_KEY` on the server to enable cloud AI. The local mode intentionally trusts callers on the same device. It checks the socket address, allowed browser origins and Host header; forwarded headers cannot grant local access. Do not use this mode on a shared server, LAN, tunnel or public reverse proxy.

You may leave keys blank and open the workspace to explore local tools. Offline assistance downloads model weights on first use, is text-only and depends on browser/hardware support; it is not a replacement for image analysis.

## Shared server with Supabase

1. Create a **new** Supabase project dedicated to this edition. Use no private product database or credentials.
2. Apply the fresh-project schema and run the isolation tests described in [database.md](database.md).
3. Enable Google OAuth in Supabase Auth, configure your own Google OAuth client, and allow the exact application redirect URL. Avoid wildcard production redirects. Do not enable anonymous sign-ins as a substitute for account authentication.
4. Set `AUTH_MODE=supabase`, `VITE_SUPABASE_URL`, the public `VITE_SUPABASE_ANON_KEY` (a publishable key or legacy anon key), `VITE_APP_URL` and the exact `CLIENT_URL` origin. Browser configuration is compiled at build time, so rebuild when it changes.
5. Configure server-only provider keys. Never use a service-role/secret Supabase key; JWT verification uses the public project key and `auth.getUser(token)`.
6. Configure private Realtime authorization as described in the database guide. Invite existing user IDs through the owner membership mechanism; workspace URLs alone do not grant access.

Only explicitly published museum content is anonymously readable. Workspaces, member lists, annotations and embeddings remain private. Sign in before making cloud requests. A missing/invalid session returns 401; missing auth configuration returns a service/configuration error instead of allowing anonymous usage.

## Environment reference

| Variable | Use |
| --- | --- |
| `HOST`, `PORT` | API bind interface/port; loopback by default |
| `AUTH_MODE` | `supabase` default; `local` only for a trusted device |
| `CLIENT_URL` | Comma-separated exact allowed origins; no wildcard |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Server-only AI configuration; choose a model supported by your account |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Public project configuration for browser and auth verification |
| `VITE_APP_URL` | OAuth return origin/application URL |
| `VITE_API_URL` | API base; `/api` recommended for same-origin hosting |
| `ENABLE_POLYCAM`, `POLYCAM_API_KEY` | Explicit experimental provider opt-in and server-only key |
| `EUROPEANA_API_KEY`, `HARVARD_API_KEY` | Optional museum-reference integrations |
| `STATIC_DIR` | **Only** the build output `<applicationRoot>/dist`; other paths, source roots and symlinked directories are rejected |
| `TRUST_PROXY` | Defaults to 0; enable only for the exact trusted reverse-proxy topology |

Provider availability, terms, quotas and supported models change independently from this project. A key does not guarantee access to every model or API. Configure spending limits in your provider accounts.

## Production

```sh
npm ci
npm run check
```

Set `NODE_ENV=production`, `STATIC_DIR=dist`, `AUTH_MODE=supabase`, your public URL/origin settings and provider secrets, then run `npm start`. Do not use `STATIC_DIR=.` or a source folder; the server checks the canonical `dist` path and fails closed when misconfigured. Use the built Express server behind a TLS reverse proxy. A same-machine proxy can reach the default loopback listener; do not expose the Vite development server.

Set environment variables with your hosting secret store or shell. Examples: PowerShell `$env:STATIC_DIR='dist'; $env:NODE_ENV='production'; npm start`; POSIX `STATIC_DIR=dist NODE_ENV=production npm start`. Never embed provider secrets into a container image or frontend build argument named `VITE_*`.

Configure the proxy to strip client-supplied forwarded headers before adding its own, limit body sizes and connections, and apply per-account quotas appropriate for your deployment. The bundled rate/concurrency limits are process-local; multiple instances need coordinated limits. Keep temporary/model directories outside `STATIC_DIR`, with filesystem permissions restricted to the server account.

## Production Content Security Policy

The Express backend emits an enforced CSP header when `NODE_ENV=production`, both for API responses and frontend files. The policy forbids arbitrary external image hosts, frames, objects and unsafe JavaScript eval; it permits `wasm-unsafe-eval` for supported WebAssembly use, inline CSS for existing React components, and local/blob workers for WebLLM. No service worker is registered: the repository has a valid `manifest.webmanifest` but does not contain a reviewed `sw.js`. Do not claim offline PWA caching until a versioned service worker is implemented and tested.

Allowed network origins include the Met Museum and Wikipedia APIs, curated model artifact origins, known texture and font origins and the exact HTTPS Supabase origin (plus matching WSS). Check WebLLM model redirects, XR/3D assets, OAuth and museum images in a staging browser with your production-build configuration. Preserve the CSP header at the reverse proxy and review each origin before adding it to the policy.

## Verification and troubleshooting

- `GET /api/health` checks liveness. `GET /api/setup/status` reports configuration state without returning keys.
- A 401 in shared mode requires signing in, checking the OAuth redirect and verifying both sides use the same Supabase project.
- A 403 often indicates an unlisted origin/Host or an attempt to use local mode outside its allowed boundary.
- Cloud 503/configuration errors mean the required key/provider/auth is unavailable. Restart after changing server environment values.
- Large or invalid files are rejected. Compress photos to supported PNG/JPEG/WebP before uploading; renamed files and client MIME declarations are not sufficient.
- Photogrammetry is experimental and disabled by default. Confirm current Polycam API/account compatibility before opt-in; no live provider call is performed by the automated test suite.
- Browser history is local to the current origin/profile. Changing domains does not migrate it.

See the [release checklist](security-release-checklist.md) for source verification and production deployment checks.
