# Handover: PropertyMaster Part A (partial)

Date: 2026-11-16. Written at the end of the first build session.

## Where the working copy is

- Working copy: **E:\Property Master Build** (drive E:, about 133 GB free at start).
- D: was not used.
- Master copy: https://github.com/thesoulcatcher/PropertyMaster (branch `main`).
- **Not pushed.** The build sandbox could not reach github.com over git ("Bad access" on port 443), although curl could fetch the same pages. The repository content was fetched as an archive, and the commits sit only in E:\Property Master Build.
- To publish the commits, run this on a machine with GitHub access:

```bash
cd "E:/Property Master Build"
git push -u origin main
```

Commits, oldest first:

| Commit | What |
|---|---|
| c9fc8a0 | Baseline README from the remote |
| eee1d17 | Scaffold, decisions, questions, spend log |
| 5e86299 | Purchase tax calculator (SDLT, LBTT, LTT) with tests |
| 9c7ba6d | Deal, refinance, auction and HMO calculators with edge-case tests |
| 187c875 | Area risk source registry, feature flags and tests |
| 75bc25d | Em dash check made encoding-safe |

## What is done (Part A slice)

- Calculators, all pure functions with tests (61 tests pass, including the outreach controls):
  - Purchase tax by nation: England, Northern Ireland (SDLT), Scotland (LBTT with ADS), Wales (LTT).
  - Deal: total cost, gross and net yield, monthly cashflow, exit profit.
  - Refinance test: loan to value and interest cover, the lower one wins.
  - Auction: maximum bid that keeps the target profit (solved by bisection).
  - HMO: room sizes and occupancy, mandatory licence check (England only).
- Area risk source registry (`src/data/area-sources.js`): flood, crime and house price sources, each with licence, attribution, level and wording. No data is fetched.
- Feature flags (`src/config/flags.js`): every gated feature is off, with its compliance row.
- Docs: DECISIONS.md (D-001 to D-006), QUESTIONS.md (3 questions, as the brief allows), SPEND-LOG.md.

## What is a stub or not started

- **Module 1, foundation** (setup, design system, sign-up and sign-in, email verification, roles, audit log, data export, account deletion): not started.
- **Module 2, pay and trial** (trial, tiers, referral, refund, payment provider): not started. No provider chosen yet.
- **Module 3, Property Mentor courses**: not started.
- **Module 4, law and rights by nation** (table UI, rows with sources): not started. Only the purchase tax table exists, and it is unverified.
- **Module 5, calculators**: the logic exists and is tested. No user interface yet.
- **Area maps (14b)**: the source list exists. No maps, graphs, heat maps or data loading.
- No web or desktop shell, no database, no Android. The Node project runs tests only.

## Unverified figures (must be checked before any member sees them)

- Every purchase tax band in `src/data/purchase-tax.js` and every surcharge (`verified: false`). They are written from memory.
- HMO room sizes and England's licence threshold in `src/calc/hmo.js` (`verified: false`).
- Licence and attribution wording for every area source (`verified: false`).
- Scotland and Wales HMO rules are not modelled. The module says so.

## Exact commands

Run and test (Node 20 or later; this machine has Node 24.22.2 and needs nothing installed):

```bash
cd "E:/Property Master Build"
node --test
```

Build: there is no build step yet. The web and desktop builds start in Part B.

## Next three tasks

1. **Verify the tax and HMO tables.** Check each band and surcharge at gov.uk, Revenue Scotland and the Welsh Revenue Authority, and the HMO room sizes at gov.uk. Set `verified: true` with the date only when checked. Owner: next session, with web access.
2. **Start module 1, foundation.** Choose the web and desktop framework (see QUESTIONS.md, question 2), then build sign-up, sign-in, roles and the audit log behind tests. Record the choice in DECISIONS.md.
3. **Publish the commits.** Push from a machine with GitHub access (the command above), then confirm the remote matches E:\Property Master Build.

## Clean-up left for the owner

- Two temporary files are on E: from the archive fetch: `E:\pm-main.zip` and `E:\pm-extract\`. A delete command for them was blocked by the safety check, so they were not removed. Delete them by hand; they are not part of the repository.
