# Security Policy

## Supported Versions

Security fixes target the latest stable minor release. Prerelease versions such as
`next` and `rc` are supported for validation, but fixes may land in a newer
prerelease instead of being backported.

| Version | Supported |
| --- | --- |
| Latest stable | Yes |
| Previous stable minor | Best effort |
| Prerelease | Best effort |

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability. Report it
privately through GitHub Security Advisories for this repository, or contact the
maintainer through the repository owner profile if advisories are unavailable.

Include:

- Affected package and version.
- Minimal reproduction or attack scenario.
- Expected impact.
- Whether a workaround exists.

## Response Expectations

- We will acknowledge valid reports as soon as possible.
- Confirmed high-risk issues block stable releases until fixed or explicitly
  documented with a mitigation.
- Fixes should include tests, release notes, and upgrade or rollback guidance.

## Release Safety

Stable releases must pass the engineering gates documented in
`docs/guide/engineering.md`, including type checks, package boundary checks,
tests, builds, and release rollback notes.
