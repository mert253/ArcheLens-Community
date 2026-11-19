# Release checklist

## Source releases

- Run the build, test, dependency and credential checks on the revision being released. Review failed checks and record any limitations.
- Run the browser smoke test against the compiled app. Verify it renders under the production Content Security Policy and the policy blocks the test inline script and unapproved image origin.
- Review the branches, tags, Git history and release assets that will be published for credentials, personal data, private datasets and redistribution rights. Inspect the reports and attachments that will become visible.
- Review changes to authentication, database access, uploads and provider integrations for security regressions. Update the setup and security reporting documentation when behavior changes.
- Enable private vulnerability reporting for the public repository.

```sh
npm ci
npm run check
node --test scripts/browser_csp_smoke.mjs
npm audit --audit-level=low
npm ci --prefix supabase/tests
npm test --prefix supabase/tests
npm audit --prefix supabase/tests --audit-level=low
python3 -B -m unittest discover -s scripts -p test_scan_secrets.py
python3 scripts/scan_secrets.py . --mode worktree
python3 scripts/scan_secrets.py . --mode history --privacy
```

The browser test requires Chrome or Chromium. History scanning covers only the refs present in the local checkout.

## Shared deployments

Before hosting an instance, review the [deployment guide](setup.md) and verify your configuration in staging.

- Serve the compiled frontend with `NODE_ENV=production`, `STATIC_DIR=dist`, `AUTH_MODE=supabase` and the exact production origin in `CLIENT_URL`. Verify TLS, trusted proxy settings and the Content Security Policy on responses.
- Use a dedicated Supabase staging project to verify authentication, role isolation, private Realtime channels and anonymous reads of published museums. Compare the database grants and policies with the [database guide](database.md).
- Test the features enabled for the deployment, including OAuth redirects, museum images, catalogues, browser model downloads and any optional provider integrations.
- Back up an existing database and review its schema and data before applying a migration. Use the fresh-project schema for new databases.
