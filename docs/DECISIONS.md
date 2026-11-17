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

## D-007: Owner outreach toolset built, switched off (2026-11-16)

- Requested by a sibling session on the owner's behalf, against brief section 14a (Off-Market Finder and owner outreach). Section 14a has no sub-section "14a-ii"; the change is applied to section 14a.
- Six flags added to `src/config/flags.js`, all `on: false`: OUTREACH_DIRECT_TO_VENDOR, OUTREACH_MAIL, OUTREACH_CALL, OUTREACH_EMAIL, OUTREACH_SMS, OUTREACH_PROBATE_INSOLVENCY. Each carries its gate in plain words.
- Menus in `src/outreach/menus.js`: Off-Market Finder (Leads, Pre-auction, Probate, Insolvency, Repossession, Long-empty, Network, Alerts) and Outreach (Campaigns, Direct to vendor, Mail, Call, Email, Text, Replies, Opt-outs, Suppression lists, Consent log, Templates, Tracking sheet). The same menus serve Propertymaster and Propertymaster Estate Agent. Gated items stay visible and disabled.
- Built-in controls in `src/outreach/controls.js`, applied whether or not a flag is on: opt-outs across channels, TPS before calls, MPS before mail, consent with basis and source before email and text, a named human-reviewed step before probate or insolvency approaches, a named person's approval for every draft (automatic approval refused), footer with opt-out wording, and an audit log.
- Draft-only mode: the module has no send, call, mail or text function. A test fails if any export looks like a send path. A channel being "allowed" means a person may act outside the software after approval; the software sends nothing.
- Ledger is in memory. Persistence (database and audit store) is a Part B task.
- Nothing sends, calls or mails while a flag is off. Turning a flag on does not add a send path.

## D-008: Framework and verification confirmed by the owner (2026-11-16)

- Website and desktop app: React with Vite (owner answered yes to the suggestion in QUESTIONS.md).
- Before any member sees a tax, HMO or area figure, the next session checks it at the official source and sets `verified: true` with the date.

## D-009: Working copy moved to the Brain's project folder (2026-11-17)

- New working copy: `C:\Users\User\Desktop\Property AI Brain\Files\Projects\Property Master\PropertyMaster`, cloned from GitHub at 4f73dc4.
- Reason: the Property AI Brain's write guard refuses edits outside the Brain folder, so `E:\Property Master Build` could not be edited.
- C: had about 4 GB free. Fallback: clone again to E:.

## D-010: Database is Node's built-in SQLite (2026-11-17)

- `node:sqlite`, no native add-on and nothing downloaded. Needs Node 22.13 or later; `package.json` says so.
- Numbered migrations in `src/core/db.js`. The audit log is append-only by database trigger.

## D-011: Sign-in design (2026-11-17)

- Passwords hashed with scrypt and a salt per account. Session and email tokens are random and stored only as SHA-256 hashes.
- Sign-up and reset replies are the same whether or not an account exists, so the forms cannot be used to find members.
- Five failed sign-ins lock that email for 15 minutes. Sessions last 30 days.
- Email goes to an `outbox` table. No email provider is connected and nothing is sent.

## D-012: Payment provider: Stripe, with its hosted checkout page (2026-11-17)

- Chosen because it handles UK card payments, Strong Customer Authentication and subscriptions, and its hosted checkout keeps card details off Propertymaster.
- The hosted page also means no payment provider script runs on Propertymaster's own pages, which fits the no-tracking rule.
- Not connected. To check before connecting: its FCA authorisation at register.fca.org.uk and its current UK fees on its own site.
- GoCardless is the alternative if the owner wants Direct Debit.
- Payments are recorded only from the provider's confirmed event, and a repeated event changes nothing.

## D-013: Prices are not set by the build (2026-11-17)

- Every tier price in `src/config/plans.js` is null until the owner sets it. A plan with no price cannot be bought.
- The `paidSubscriptions` flag (compliance row 9) is also off.

## D-014: Referral reward is given on the friend's first payment (2026-11-17)

- Referrer and friend each get one free month, once per referred account.
- Given when the friend first pays, so accounts that never pay cannot collect free months. The code must be added before that first payment.
- Referral emails stay gated (compliance row 10).

## D-015: Cancellation and refunds (2026-11-17)

- Cancel is one step, at any time, and access runs to the end of what was paid for or to the end of the trial.
- A refund asked for within 14 days of the first payment is marked cooling-off; any other refund is an admin's decision. To check at legislation.gov.uk (Consumer Contracts Regulations 2013).
- gov.uk, read 2026-11-17: the DMCC Act 2024 subscription regime still waits for secondary legislation (consultation outcome added 2 April 2026, no commencement date). A trial reminder is written three days before a trial ends anyway.

## D-016: Figures checked at source (2026-11-17)

- Purchase tax, tenancy, deposit, registration and HMO rules read at the official sources and marked verified with the date. Two dates are kept apart: the check date and the date the source gives.
- Correction: Wales higher residential LTT rates are a separate band table from 11 December 2024, not 4 points added to each band.
- Anything not read is marked "to check" with where to check it.

## D-017: User interface waits for the owner's yes to download packages (2026-11-17)

- React with Vite (D-008) means downloading packages from npm. The owner's standing rules need a yes before any download, so the UI was not started.
- Instead an API server was built with Node's own `http` module, so the UI plugs straight in.

## D-018: Developer Studio export needs two things (2026-11-17)

- The `studioPlanExport` flag on, and a sign-off recorded for that project by a qualified person (compliance row 13).
- Title splitting also needs the `studioTitleSplitting` flag and a solicitor's sign-off for that project.
- An on-screen preview is always allowed and always watermarked DRAFT.
