# Phase 1 report

Status date: 2026-11-17. Part A logic is built and tested. No user interface yet. Part B is not started, apart from the outreach toolset from session one.

## Works (tested, 146 tests passing with `node --test`)

| Area | What works |
|---|---|
| Accounts | Sign-up (member or estate agent only), email verification, sign-in, 30-day sessions, sign-out, lockout after 5 failures for 15 minutes, password reset and change |
| Roles | member, estate_agent, admin, owner; developer and agent sections chosen by login; only an owner makes staff; the last owner cannot be removed |
| Records | Append-only audit log (the database refuses edits and deletes); dated consent record with wording version and source; optional consents default off |
| Your data | Profile, settings, full data export, account deletion that erases personal data |
| Compliance | The fourteen-row register; sign-offs with professional, role, reference and date; a flag opens only with its sign-off |
| Pay and trial | Trial, tiers, referral, cancel, resume, refunds, reminders, revenue summary |
| Property Mentor | Six courses, 19 lessons, quizzes, progress |
| Law by nation | Seven topics, four nations, Scotland first, sources and dates |
| Calculators | Purchase tax (checked), deal, refinance, auction, HMO (checked for England, Scotland, NI) |
| Area maps | HPI trends, crime counts and sourced rates, flood wording, graph, heat map, map |
| Developer Studio | Projects, draft scopes, 3D model, walkthrough, preview, gated export and staging |
| API | Every route above, signed in and role checked |

## Stubs

- No website, no desktop app, no Windows installer, no production build. Waiting for the owner's yes to download React and Vite.
- Email to outbox only; payment provider not connected; area data not downloaded; no map boundaries loaded.
- Modules 6 to 12 not started (admin has API routes only).

## Gated (off and labelled)

See `src/config/flags.js` and `docs/HANDOVER.md`. Every gated feature is off.

## Dependency check

`package.json` has no dependencies at all, so no Google SDK is in any build. Database is Node's built-in `node:sqlite`. Checked 2026-11-17.

## Figures checked at source on 2026-11-17

- Purchase tax: gov.uk (SDLT), Revenue Scotland (LBTT and ADS), gov.wales (LTT). The Wales higher rates in session one were wrong (an added 4 points); gov.wales publishes a separate table from 11 December 2024, now used.
- Tenancy, deposit, registration and HMO rows: mygov.scot, gov.uk, gov.wales, rentsmart.gov.wales, nidirect.gov.uk, belfastcity.gov.uk, legislation.gov.uk.
- Subscription rules: gov.uk showed the DMCC Act 2024 subscription regime still waiting for secondary legislation (consultation outcome 2 April 2026, no commencement date).

## Not verified

- Each "to check" item in `src/data/law-by-nation.js` and `src/data/studio.js` (approvals by nation for building work).
- The UK HPI CSV column names against the current download.
- police.uk's current rate limit; each flood dataset's licence.
- Stripe's FCA authorisation (to check at register.fca.org.uk before connecting).
- Course content is a draft for the owner's review.
- Nothing has been run in a browser or on a device.

## Next three tasks

1. Push (after the owner's yes).
2. Website shell in React with Vite over the API (after the owner's yes to download it).
3. Close the "to check" items, then module 6, deal exchange rooms.
