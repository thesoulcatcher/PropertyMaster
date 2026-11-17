// Starts the API on this machine only (127.0.0.1). Nothing is published.
//
//   node src/server/start.js
//
// Settings come from environment variables, never from a file in the repository:
//   PORT              default 8787
//   PM_DB_PATH        default ./data/propertymaster.db (the data folder is git-ignored)
//   PM_ALLOW_ORIGIN   the website's dev address, default http://localhost:5173
//   PM_OWNER_EMAIL and PM_OWNER_PASSWORD
//                     on first start only: create the owner account if none exists

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createContext } from '../core/context.js';
import { createApiServer } from './api.js';
import { createStaff } from '../core/auth.js';

const port = Number(process.env.PORT) || 8787;
const dbPath = resolve(process.env.PM_DB_PATH || './data/propertymaster.db');
mkdirSync(dirname(dbPath), { recursive: true });

const ctx = createContext({ dbPath });

const owners = ctx.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND deleted_at IS NULL").get().n;
if (owners === 0 && process.env.PM_OWNER_EMAIL && process.env.PM_OWNER_PASSWORD) {
  createStaff(ctx, { email: process.env.PM_OWNER_EMAIL, password: process.env.PM_OWNER_PASSWORD, displayName: 'Owner', role: 'owner' });
  console.log('Owner account created.');
} else if (owners === 0) {
  console.log('No owner account yet. Set PM_OWNER_EMAIL and PM_OWNER_PASSWORD and start again to create one.');
}

const server = createApiServer(ctx, { allowOrigin: process.env.PM_ALLOW_ORIGIN || 'http://localhost:5173' });
server.listen(port, '127.0.0.1', () => {
  console.log(`Propertymaster API on http://127.0.0.1:${port} (database: ${dbPath})`);
});
