# Security

## Reporting

For private vulnerability disclosure, email <tondays52@gmail.com>. Please do not open a public issue for
unfixed security problems.

## Deployment security notes

- Live API keys are never committed. They live in `frontend/.env` (gitignored). See `frontend/.env.example`
  for the full variable list.
- The Google Maps key is restricted by IP. A previously committed key was revoked and rotated out of all
  history; GitHub secret scanning and CodeQL confirm no live keys remain in the repository.
- Requests to the live oracle (`BlockProverAttestationOracle`) are read-only attestation pulls; verification
  happens in-browser against Sepolia RPCs, not through a trusted backend.

## Dependency advisory status (accepted)

The remaining GitHub Dependabot alerts apply exclusively to the **root `package-lock.json`**, i.e.
build-time transitive dev-dependencies of the Hardhat toolchain (`undici`, `ws`, `lodash`,
`serialize-javascript`, `elliptic`, `tmp`, `adm-zip`, `uuid`, `cookie`). They are accepted for these reasons:

- `npm audit --omit=dev` reports **0 production vulnerabilities**; the frontend runtime has its own
  dependency tree (not affected by these alerts).
- None of these packages ship in the deployed artifacts, the browser bundle, or the contracts.
- Fixing them requires overriding versions outside the ranges Hardhat pins, and `elliptic` currently has
  **no patched release**. A forced upgrade risks breaking the test suite for no shipped-code benefit.
- The test/build pipeline (`npm run test`, `npm run build`) is green at the analyzed commit
  (99/99 tests passing).

Revisit whenever an upstream release (Hardhat or a patched `elliptic`) resolves any remaining advisory.