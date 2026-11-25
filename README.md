# PropertyMaster
The comprehensive property developer, sourcer, investor, deal maker software &amp; community with unparalleled community features, training. roleplay ai agents and full assistance on property development savvy brokers, surveying and conveyancing training. lettings, insurance and accounting, all in one place. mobile apps for pc, mac, ios and android too

## Build status (Part A logic built, no user interface yet)

Node 22.13 or later. No dependencies, nothing to install.

Run the tests:

```bash
node --test
```

Start the API on this machine (http://127.0.0.1:8787):

```bash
node src/server/start.js
```

The website (React with Vite) lives in `web/`. Install its packages once:

```bash
npm --prefix web install
```

Run it while the API is running (opens on http://127.0.0.1:5173):

```bash
npm --prefix web run dev
```

Build it for production (output in `web/dist`):

```bash
npm --prefix web run build
```

Windows desktop app and installer (Electron) live in `desktop/`. Install once:

```bash
npm --prefix desktop install
```

Build the website and the installer (output: `desktop/release/Propertymaster Setup 0.1.0.exe`):

```bash
npm --prefix desktop run dist
```

The app runs its own server on 127.0.0.1 at a free port and keeps each member's data in their Windows profile (`%APPDATA%\Propertymaster`). It sends nothing anywhere. If the build stops while downloading NSIS (a firewall can block electron-builder's downloader), see "Windows installer" in `docs/HANDOVER.md`.

See `docs/HANDOVER.md` for the state of the build, `docs/PHASE-1-REPORT.md` for what works and what is a stub, and `docs/DECISIONS.md` for the choices made.
