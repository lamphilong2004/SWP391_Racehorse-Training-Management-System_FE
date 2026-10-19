# Staging builds (official runtime)

Leader directive of 2026-10-18: Racehorse is a real product.
- The deployed application always uses the real API client.
- The sample business store is test-only, and no runtime build can reach or bundle it.
- Sample staging builds are retired. The previous sample Preview deployment (`fbfe47f` / `0b3aa42`) stays on Vercel only as a regression reference until a replacement is verified.

## Profiles (`RACEHORSE_STAGING_MODE`)

| Profile | Command | Behaviour |
|---|---|---|
| `preview` | `npm run build:staging:preview` | **Protected, non-production Preview only.** Real API client with a role test login for UI inspection before the Auth API is online. The seven test roles carry no password, no JWT and no server authority. Every API call made with a test identity fails with `503 SERVER_UNAVAILABLE` before reaching the network. Screens show that error; nothing is created, changed or saved. `VITE_API_BASE_URL` is optional and must be a public HTTPS origin if set. |
| `api` | `npm run build:staging:api` | Real login and real API calls. Requires `VITE_API_BASE_URL=https://<public-backend-origin>`. Rejects the role test login and every sample/harness flag. |

The normal `npm run build` is the production build:
- real login only
- no role test login, test identities or sample code

The build script fails if any profile's output contains:
- the sample store key
- sample adapter chunks
- the developer harness

It also fails if an `api` output contains the role test login or test identities.

## Release rules

- **Production** is built from `main` by Vercel with `npm run build` (see `docs/RELEASE-POLICY.md`, 19 October 2026). Staging profiles refuse to build Production.
- **Preview** builds accept only `integration/fe-product-main`.
- `vercel.json` keeps `git.deploymentEnabled: false`. Every Preview is a manual, Leader-authorized deployment.
- Switching the existing Vercel Preview from `sample` to `preview` requires changing `RACEHORSE_STAGING_MODE` in the Vercel Preview environment. A build that still uses `sample` now fails on purpose.

## Local checks

```bash
npm run build:staging:preview
```

```bash
node scripts/serve-staging.mjs dist-staging-preview 5196
```

```bash
npm run test:staging:build
```

The UI checks for the role test login are in `src/staging/roleTestLogin.test.tsx`:
- seven roles
- no network calls
- 503 on API use
- no sample store
- RBAC and sign-out

## What is still not proven

Backend authentication, RBAC, SQL Server persistence and real business transactions are **NOT VERIFIED** until the backend staging API is online and the API profile is tested against it.
