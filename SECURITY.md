# Security policy

## Supported versions

The current main branch and latest published release receive security fixes. This project is pre-1.0; deployment operators should review configuration and upgrade promptly.

## Report privately

Use GitHub's **Report a vulnerability** feature on the repository's [Security tab](https://github.com/mert253/ArcheLens-Community/security) when available. If unavailable, open an issue requesting a private reporting channel. Keep technical details, credentials and sensitive records in the private report.

Include the affected version, deployment mode, trust boundary, prerequisites, expected/actual behavior and a minimal synthetic reproduction. Redact tokens and identifying information. Please avoid destructive tests, paid API usage, accessing another person's data or scanning unrelated infrastructure.

## Security boundaries

- Shared servers use Supabase JWT verification and database ownership policies. A browser route guard is not an authorization boundary.
- Local mode is explicitly opt-in and trusts the local device user; it requires loopback binding, socket and Host checks and exact allowed origins.
- Provider keys are server-only. Administrative Supabase keys are unnecessary. `VITE_*` values are publicly visible.
- Uploaded images are untrusted. Keep bounded request/file/concurrency limits and content validation before provider calls.
- Workspace membership and database policies control access. Do not replace them with client-supplied identities or shared URLs.
- Never serve configuration, uploads or database files as frontend static assets. Keep secrets out of logs, error responses and Git history.

## Release checks

See the [release checklist](docs/security-release-checklist.md) for source checks and predeployment verification. Record the tested revision, checks performed and any unresolved findings.
