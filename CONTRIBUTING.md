# Contributing

Thank you for helping build reusable tools for archaeology and cultural heritage.

## Get started

Read [README.md](README.md) and the [setup guide](docs/setup.md). Install with `npm ci`, work on a feature branch and use synthetic/public fixtures. You do not need production credentials to run the automated tests.

Before opening a pull request, run:

```sh
npm run check
npm audit
```

Run credential scanning on your worktree and commit history. If you change database policies, run the SQL isolation suite against a disposable project and describe the account/role cases checked. Do not test against another person's project or a production heritage dataset.

## Pull requests

Explain the problem, resulting behavior and validation. Keep changes focused and include meaningful regression tests for security boundaries or behavior changes. Preserve English and Turkish interface strings where applicable. Document configuration, API, schema and privacy implications. Use standard TypeScript/React patterns and preserve accessible names, keyboard controls and responsive layouts.

Do not include secrets, populated environment files, personal contact information, private site coordinates, uploaded research images or copied proprietary code. Public datasets, images and model weights require verified redistribution terms and attribution. Treat AI-generated descriptions and reconstructions as hypotheses requiring evidence, not established archaeological facts.

By intentionally submitting a contribution for inclusion, you offer it under this project's Apache-2.0 license, as described in section 5 of that license. You retain copyright. Do not submit material you lack permission to license. There is no automatic copyright assignment, separate commercial license or contributor license agreement.

Security reports belong in the private reporting channel described in [SECURITY.md](SECURITY.md). Public issues should contain minimal, redacted reproduction steps. Participation follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
