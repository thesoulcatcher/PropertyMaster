# Decisions

Each decision has a date, the reason and what it affects. Newest at the bottom.

## D-001: Working copy location and drive (2026-11-16)

- The master copy is the GitHub repository thesoulcatcher/PropertyMaster.
- The working copy is `E:\Property Master Build` (E: had 133 GB free, above the 5 GB threshold).
- `D:\Property Master Build` is the fallback only if E: is unavailable.
- Brain folder is not used for code or documents.

## D-002: Stack for Part A (2026-11-16)

- Node.js 20 or later (this machine has Node 24.22.2), plain ES modules, no runtime dependencies.
- Tests use the built-in `node:test` runner, so no test framework is installed and no package is downloaded.
- Reason: keeps the spend near zero and the calculators easy to audit.
- The web and desktop shells, database and auth are not chosen in Part A. They come in Part B or a later session, once the owner confirms the framework.

## D-003: Purchase tax tables are data, not code (2026-11-16)

- Purchase tax bands (SDLT, LBTT, LTT) live in `src/data/purchase-tax.js` with a source, a rate-table date and a `verified` flag.
- Every band table is marked `verified: false` in this session because the official pages were not checked on the day of use.
- The calculators show the source and the flag next to every tax figure.

## D-004: Compliance gates are off by default (2026-11-16)

- Every gated feature is set to `false` in `src/config/flags.js` and carries its compliance row number from the brief (section 11).
- Nothing in Part A is gated off except what the brief says must be gated: Developer Studio plan exports (sign-off), title splitting (solicitor), owner outreach (row 8), off-market outreach (row 8), lettings (row 7).

## D-005: Area risk data is listed with licence and attribution before it is fetched (2026-11-16)

- `src/data/area-sources.js` lists every flood, crime and house price source with its licence, attribution wording and disclaimer.
- No data is fetched in Part A. The layer only describes what can be fetched and how it must be shown.

## D-006: Git push is not possible from this sandbox (2026-11-16)

- `git clone` and `git push` to github.com fail with a socket error ("Bad access") from git's network stack.
- The browser-side and curl access to github.com work, so the repository content was fetched as an archive.
- The local repository holds the commits. The owner (or a session with push access) must run `git push -u origin main` from the working copy. See `docs/HANDOVER.md`.
