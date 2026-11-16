# Phase 1 report

Status date: 2026-11-16. Part A is only partly built. Part B is not started.

## Works (tested)

| Area | What works | Tests |
|---|---|---|
| Purchase tax | England, Northern Ireland, Scotland, Wales; surcharges; refused inputs | 14 (purchase-tax) |
| Deal calculator | Total cost, yields, cashflow, exit profit, formulas shown | in investment.test.js |
| Refinance test | Loan to value and interest cover, limiting test named | in investment.test.js |
| Auction calculator | Max bid keeping target profit; infeasible case returns zero | in investment.test.js |
| HMO check | Room sizes (England), occupancy, mandatory licence (England) | 7 (hmo) |
| Area sources | Licence, attribution, level and wording for each source; blocked sites listed | in area-and-flags.test.js |
| Feature flags | All gated features off, each with its compliance row | in area-and-flags.test.js |

Total: 45 tests, all passing (`node --test`).

## Stubs

- Purchase tax tables and surcharges: present but unverified.
- HMO: room sizes only for England. Scotland, Wales and Northern Ireland return "check the council" with no figure.
- Area sources: described, not fetched. No maps, graphs or heat maps.

## Not started

- Module 1 foundation (auth, roles, audit log, settings, export, deletion, consent record).
- Module 2 pay and trial (provider not chosen).
- Module 3 Property Mentor courses.
- Module 4 law and rights by nation (only the tax table exists).
- Module 6 onward, Developer Studio, Estate Agent, Off-Market Finder (Part B), virtual staging, lettings.
- Windows installer, website production build, Android.

## Gated (off, labelled in flags.js)

Studio plan export, title splitting, virtual staging (paid runs), lettings, joint ventures, finder fees, member payments, insurance, conveyancing, sourcing for others, licensed property data, owner outreach, paid advertising.

## Dependency check

No Google SDK in any build. `package.json` has no dependencies. Recorded 2026-11-16.

## Not verified

- Every tax rate and HMO rule (see HANDOVER.md).
- The git push: the commits are local only (see HANDOVER.md).
- Nothing was run on a device or in a browser.

## Next three tasks

1. Verify the tax and HMO tables at source and set `verified` with the date.
2. Choose the web and desktop stack and build module 1 foundation behind tests.
3. Push the local commits to GitHub from a machine with access.
