# Handover: PropertyMaster Part A

Date: 2026-11-17. Written at the end of the second build session (Opus 5.5 and Fable 5.2, on the owner's PC).

## Where the working copy is

- **Working copy: `C:\Users\User\Desktop\Property AI Brain\Files\Projects\Property Master\PropertyMaster`** (drive C:).
- Why C: this time: the Property AI Brain's write guard only allows edits inside the Brain folder, so the earlier copy on E: could not be edited from this session.
- C: had about 4 GB free at the start. If it runs short, clone again to E: (`git clone` from the master copy) and continue there.
- `E:\Property Master Build` is the earlier copy, at commit 4f73dc4. It is now **behind** and was not changed. It can be deleted once the new commits are pushed.
- Master copy: https://github.com/thesoulcatcher/PropertyMaster (branch `main`).
- **Not pushed.** The brief says push after each step; the owner's standing instruction for this session is "do not push without approval". The commits are local only, waiting for that yes.

## What is done

| Module | State | Tests |
|---|---|---|
| 1 Foundation | Sign-up, email verification, sign-in, sessions, password reset and change, lockout, four roles and two sections, append-only audit log, consent record, profile, settings, data export, account deletion | foundation (21) |
| 2 Pay and trial | 14-day trial (config), tiers in config, recommend-a-friend (one free month each, once, on the friend's first payment), one-step cancel and resume, refunds with cooling-off, trial reminders, revenue summary | billing (14) |
| 3 Property Mentor | Six courses (strategies by nation, auctions, marketing and ad rules, conveyancing, surveying, brokers), lessons, quizzes marked on the server, progress; seven strategy pages, each with a four-nation table | mentor (9) |
| 4 Law by nation | Purchase tax, tenancy type, ending a tenancy, rent increases, deposits, landlord registration, HMO licensing; Scotland first; every row with source, check date and source date | law (5) |
| 5 Calculators | From session one, now with tax tables and HMO rules checked at source | purchase-tax, investment, hmo |
| Area maps | UK HPI parser and trends, crime (police.uk for England, Wales, NI; Scottish Government for Scotland), flood results with each body's wording, SVG line graph, heat map and choropleth map | area-maps (12) |
| Developer Studio | Entry buttons, five tabs, 13 project types with draft scopes, 3D floorplan model, furnished and unfurnished walkthrough paths, watermarked plan preview, gated export, gated staging | studio (11) |
| API server | Every module above behind sign-in and role checks, `node:http`, no dependencies | api (9) |
| Owner outreach | From session one, unchanged | outreach |

Total: **146 tests, all passing.**

## Stubs

- **No user interface yet.** The website and desktop app (React with Vite, decision D-008) need packages downloaded from npm. That download waits for the owner's yes (see "Owner decisions" below). The API is ready for it.
- Email: messages go to an `outbox` table. Nothing is sent.
- Payments: no provider connected. Stripe is the recorded choice (D-012).
- Area data: parsers and charts work on example data. No live download or API call is made yet, and no boundary shapes are loaded.
- 3D: the model and walkthrough are data (boxes and camera stops). A 3D viewer is a UI task.
- Modules 6 to 12 (deal rooms, community, AI chat, roleplay, marketing templates beyond the course, lettings, admin screens) are not started, apart from the admin API routes.

## Gated (off, labelled, each opens only with a recorded sign-off)

Plan export, title splitting, virtual staging, paid subscriptions, referral emails, lettings, joint ventures, finder fees, member payments, insurance, conveyancing, sourcing for others, licensed property data, owner outreach (six channels), paid advertising. A flag cannot be switched on without a sign-off recorded against its compliance row.

## Exact commands

Node 22.13 or later (this PC has 24.22.2). Nothing to install.

```bash
cd "C:/Users/User/Desktop/Property AI Brain/Files/Projects/Property Master/PropertyMaster"
```

```bash
node --test
```

```bash
node src/server/start.js
```

The server listens on http://127.0.0.1:8787 only. To create the owner account on first start, set `PM_OWNER_EMAIL` and `PM_OWNER_PASSWORD` in the environment first.

Build: no build step yet. The website and Windows installer builds start with the UI.

## Owner decisions waiting

The brief allows three questions in QUESTIONS.md and all three are used, so these are listed here instead.

1. **Push**: may the local commits be pushed to GitHub?
2. **Download the UI packages**: may the next session run `npm install` for React and Vite (and later Electron for the Windows installer)? These are large, well-known open-source packages from the npm registry.
3. **Prices**: the price for each tier in `src/config/plans.js`. Until set, no plan can be bought.

## Next three tasks

1. Push the commits (after the owner's yes), then delete the old copy on E:.
2. Build the website shell in React with Vite on top of the API: sign-up, sign-in, the two sections, Property Mentor, law tables, calculators, area charts, Developer Studio. Brand tokens from brief section 9, light and dark.
3. Check the open items marked "to check" in `src/data/law-by-nation.js` (Scotland short-term lets and rent control areas, Wales rent increases and HMO threshold, England database date, NI registration penalty), then start module 6, deal exchange rooms.
