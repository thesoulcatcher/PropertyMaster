// Propertymaster for Windows. Starts the Propertymaster server inside the app on
// this computer only (127.0.0.1, a free port), with the member's data kept in
// their own Windows profile, and shows the website in a locked-down window.
// Nothing here sends data anywhere: no telemetry, no crash reporting, no updates.

const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let server = null;
let win = null;

function paths() {
  if (app.isPackaged) {
    return {
      src: path.join(process.resourcesPath, 'app-src', 'src'),
      web: path.join(process.resourcesPath, 'app-web'),
    };
  }
  return { src: path.join(__dirname, '..', 'src'), web: path.join(__dirname, '..', 'web', 'dist') };
}

async function startServer() {
  const p = paths();
  const { createContext } = await import(pathToFileURL(path.join(p.src, 'core', 'context.js')).href);
  const { createApiServer } = await import(pathToFileURL(path.join(p.src, 'server', 'api.js')).href);
  const ctx = createContext({ dbPath: path.join(app.getPath('userData'), 'propertymaster.db') });
  server = createApiServer(ctx, { staticDir: p.web });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}/`;
}

async function createWindow() {
  const url = await startServer();
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    title: 'Propertymaster',
    backgroundColor: '#14213D',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  });
  const origin = new URL(url).origin;
  // Links to other sites open in the computer's own browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target) && !target.startsWith(origin)) shell.openExternal(target);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(origin)) {
      event.preventDefault();
      if (/^https?:\/\//.test(target)) shell.openExternal(target);
    }
  });
  await win.loadURL(url);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    // Camera, microphone, location, notifications and the rest: refused.
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, done) => done(false));
    createWindow().catch((err) => {
      console.error(err);
      app.quit();
    });
  });

  app.on('window-all-closed', () => {
    if (server) server.close();
    app.quit();
  });
}
