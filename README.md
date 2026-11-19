# ArcheLens Open Source

Open tools for exploring archaeological artifacts and cultural heritage through image analysis, comparative study, maps and virtual exhibitions.

ArcheLens combines a React interface with a self-hosted Express API. Bring your own provider accounts and extend the tools for research and education.

> AI output is a research aid. Dates, attributions, inscriptions and restoration images require expert review and source verification. A confidence score is model output, not a calibrated guarantee. Restoration imagery is a hypothetical reconstruction, not evidence of an object's original appearance.


## Security

See the [security policy](SECURITY.md) for reporting and supported versions. The [release checklist](docs/security-release-checklist.md) covers source releases and deployment checks.

## Features

| Capability | Availability |
| --- | --- |
| Structured artifact reports, image comparison, contextual chat and epigraphy | Your server-side Gemini key; authentication for shared servers |
| Restoration suggestions and illustrative reconstruction | Gemini model/account support; results vary by provider |
| Computer vision, potsherd comparison, local browser history and report/CSV exports | Browser features; no database account required |
| Maps, discovery globe, timeline and collection references | Maps/catalogues require internet; optional catalogue keys |
| Virtual museums, annotations and collaborative workspaces | Your own Supabase project and schema; private channels |
| Offline text assistance | WebGPU-capable browser and initial model download; text-only, cannot inspect artifact images |
| Experimental photogrammetry | Explicit Polycam opt-in, compatible account/API and server key; disabled by default |

The original visual layout, light/dark themes and Turkish/English interface are retained. This release targets browsers. Desktop packaging and its privileged credential bridge are outside this edition. A web manifest is included; offline application-shell caching is not included.

## Quick start

Use Node.js 24 LTS (minimum 22.12), npm and Git. Python 3.10+ runs the optional credential scanner.

```sh
git clone https://github.com/mert253/ArcheLens-Community.git
cd ArcheLens-Community
npm ci
```

Copy `.env.example` to `.env.local` (`cp .env.example .env.local` on macOS/Linux, `Copy-Item .env.example .env.local` in PowerShell).

For a **trusted, single-user local installation**, explicitly set `AUTH_MODE=local`, retain `HOST=127.0.0.1`, and add your own `GEMINI_API_KEY` if you want cloud analysis. Local mode grants the local device user access to the API; it is unsuitable for shared hosting.

```sh
npm run dev:all
```

Open [localhost:3000](http://localhost:3000). Without provider keys you can open the workspace, use local tools and explore the interface; cloud actions remain unavailable. Hosted authentication defaults to fail closed and requires a configured Supabase project.

See the [setup guide](docs/setup.md) for shared deployments, OAuth, environment variables, production builds and troubleshooting. The [database guide](docs/database.md) explains schema installation and isolation tests.

## Development

```sh
npm run typecheck
npm test
npm run build
npm run build:server
npm audit
```

`npm run check` runs type checking, tests and both builds. `npm run test:watch` starts Vitest watch mode. Automated tests use synthetic fixtures and mocked provider boundaries; they do not require real keys or paid API calls. SQL isolation tests run separately against a disposable Supabase database.

```text
src/                 React UI, browser CV workers and feature modules
server.ts            Express and AI routes
server/              Authentication, input and upload security boundaries
supabase/            Fresh-project schema and SQL isolation tests
docs/                Setup, architecture, licensing and release guidance
scripts/             Reproducible credential and dependency-license checks
```

## Data and privacy

Online analysis transmits selected images and prompts to Gemini. Photogrammetry transmits photos to Polycam. Maps, model downloads and catalogue searches contact their respective providers. Browser history is saved in IndexedDB for the current origin and browser profile without application-level encryption. Use separate browser profiles on shared devices.

Never commit real keys, `.env.local`, personal records, private excavation locations, database backups or uploaded images. Only public publishable/legacy anon Supabase configuration belongs in `VITE_*`; administrative keys are rejected and never needed by this application. Do not connect this edition to a private production database. Review rights and sensitivity before publishing a museum or sharing a workspace.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md). Small, documented improvements and reproducible issues are welcome. Report vulnerabilities privately; do not include active credentials or sensitive heritage records in public issues.

## License

Project-owned code is offered under [Apache-2.0](LICENSE). See [NOTICE](NOTICE), [third-party notices](THIRD_PARTY_NOTICES.md) and the [licensing guide](docs/licensing.md) for attribution, scope and reuse. External APIs, model weights, fonts, maps and catalogue content retain their own terms.
