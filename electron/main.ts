import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, globalShortcut, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { StorageService } from './services/storage';
import { LauncherService } from './services/launcher';
import { RiotApiService } from './services/riotApi';
import { PingService } from './services/pingService';
import { RiotAccount } from './types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const storageService = new StorageService();
const launcherService = new LauncherService(storageService);
const riotApiService = new RiotApiService(storageService);
const pingService = new PingService();

function createWindow() {
  const settings = storageService.getSettings();
  const appIconPath = path.join(__dirname, '../assets/icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0A0A0A',
    frame: false,
    titleBarStyle: 'hidden',
    show: !settings.startMinimized,
    icon: fs.existsSync(appIconPath) ? appIconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Security: Prevent unauthorized window openings and handle external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Security: Prevent renderer from navigating away from the local app
  const devUrl = 'http://localhost:5173';
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== devUrl && !url.startsWith('file://')) {
      event.preventDefault();
      if (url.startsWith('https:') || url.startsWith('http:')) {
        shell.openExternal(url);
      }
    }
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL(devUrl).catch(() => {
      setTimeout(() => mainWindow?.loadURL(devUrl), 1000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle minimize to tray
  mainWindow.on('close', (event) => {
    const currentSettings = storageService.getSettings();
    if (!isQuitting && currentSettings.minimizeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Use custom high-resolution tray icon
  const trayIconPath = path.join(__dirname, '../assets/tray-icon.png');
  let icon: Electron.NativeImage;

  if (fs.existsSync(trayIconPath)) {
    icon = nativeImage.createFromPath(trayIconPath);
  } else {
    // Fallback base64 emblem
    const canvasBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVR4nGNgGFjAiM7/j06fpt4gY2x8dJqRkhB4TE070A1A14tLDC4NyDbhUoPuBVQNuPz/H5+3yDbi8iO6AagGkGQhkgGErMdlEDabkP3/n55xQ8UAGJ8Y/z+C+cTph8FhAAD4jCj7a4uS6QAAAABJRU5ErkJggg==',
      'base64'
    );
    icon = nativeImage.createFromBuffer(canvasBuffer);
  }

  tray = new Tray(icon);
  tray.setToolTip('Riot Account Manager');

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const accounts = storageService.getAccounts();
  const accountMenuItems: Electron.MenuItemConstructorOptions[] = accounts.map((acc) => ({
    label: `${acc.label} (${acc.region})`,
    submenu: [
      {
        label: `Play Valorant`,
        enabled: acc.games === 'valorant' || acc.games === 'both',
        click: () => {
          launcherService.launchAccount(acc.id, 'valorant');
        },
      },
      {
        label: `Play League of Legends`,
        enabled: acc.games === 'league' || acc.games === 'both',
        click: () => {
          launcherService.launchAccount(acc.id, 'league');
        },
      },
    ],
  }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Riot Account Switcher',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Show Dashboard',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quick Switch Accounts',
      submenu: accountMenuItems.length > 0 ? accountMenuItems : [{ label: 'No accounts saved', enabled: false }],
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// Register hardened IPC Listeners
function setupIpcHandlers() {
  ipcMain.handle('accounts:get', () => {
    return storageService.getAccounts();
  });

  ipcMain.handle('accounts:save', async (_event, account: RiotAccount, password?: string) => {
    if (!account || typeof account !== 'object') {
      throw new Error('Invalid account payload');
    }
    // Sanitize string inputs
    account.label = String(account.label || '').slice(0, 60);
    account.username = String(account.username || '').slice(0, 60);
    // Auto-detect Riot ID & tagline if not manually entered
    if (!account.riotId || account.riotId === account.label || !account.tagline) {
      try {
        const detected = await riotApiService.detectActiveSession();
        if (detected && detected.riotId) {
          account.riotId = detected.riotId;
          account.tagline = detected.tagline;
        }
      } catch {}
    }

    // Fetch real live stats from Riot Client (no fake ranks)
    try {
      const realStats = await riotApiService.fetchAccountStats(account);
      if (realStats.valorantStats) account.valorantStats = realStats.valorantStats;
      if (realStats.leagueStats) account.leagueStats = realStats.leagueStats;
    } catch {
      if (!account.valorantStats) account.valorantStats = riotApiService.getCleanDefaultValorantStats();
      if (!account.leagueStats) account.leagueStats = riotApiService.getCleanDefaultLeagueStats();
    }

    storageService.saveAccount(account, password);
    updateTrayMenu();
  });

  ipcMain.handle('accounts:delete', async (_event, id: string) => {
    if (typeof id !== 'string' || !id) return;
    storageService.deleteAccount(id);
    updateTrayMenu();
  });

  ipcMain.handle('launcher:launch', async (event, accountId: string, game: 'valorant' | 'league') => {
    if (typeof accountId !== 'string' || (game !== 'valorant' && game !== 'league')) {
      throw new Error('Invalid launch request parameters');
    }
    return launcherService.launchAccount(accountId, game, (status) => {
      event.sender.send('launcher:status', status);
    });
  });

  ipcMain.handle('riot:refresh-stats', async (_event, account: RiotAccount) => {
    if (!account || !account.id) throw new Error('Invalid account');
    const stats = await riotApiService.fetchAccountStats(account);
    const accounts = storageService.getAccounts();
    const idx = accounts.findIndex(a => a.id === account.id);
    if (idx >= 0) {
      if (stats.valorantStats) accounts[idx].valorantStats = stats.valorantStats;
      if (stats.leagueStats) accounts[idx].leagueStats = stats.leagueStats;
      storageService.saveAccounts(accounts);
    }
    return stats;
  });

  ipcMain.handle('riot:detect-current-session', async () => {
    return riotApiService.detectActiveSession();
  });

  ipcMain.handle('settings:get', () => {
    return storageService.getSettings();
  });

  ipcMain.handle('settings:save', (_event, settings: any) => {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid settings object');
    }
    return storageService.saveSettings(settings);
  });

  ipcMain.handle('settings:select-path', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select RiotClientServices.exe',
      filters: [{ name: 'Executables', extensions: ['exe'] }],
      properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('vault:export', (_event, passphrase: string) => {
    if (typeof passphrase !== 'string' || passphrase.length < 6) {
      throw new Error('Passphrase must be at least 6 characters.');
    }
    return storageService.exportEncryptedAccounts(passphrase);
  });

  ipcMain.handle('vault:import', (_event, bundleJson: string, passphrase: string) => {
    if (typeof passphrase !== 'string' || !passphrase) {
      throw new Error('Passphrase is required.');
    }
    if (typeof bundleJson !== 'string' || bundleJson.length < 10) {
      throw new Error('Invalid vault bundle data.');
    }
    const result = storageService.importEncryptedAccounts(bundleJson, passphrase);
    updateTrayMenu();
    return result;
  });

  ipcMain.handle('ping:all', () => {
    return pingService.pingAllRegions();
  });

  // Window control commands
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
  createTray();

  // Register Global Shortcuts
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
