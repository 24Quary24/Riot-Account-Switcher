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
const riotApiService = new RiotApiService(storageService);
const launcherService = new LauncherService(storageService, riotApiService);
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
      label: 'Log Out Riot Client',
      click: async () => {
        await launcherService.forceLogoutRiotClient();
      },
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

    // Keep user's custom Riot ID and tagline; never overwrite with other accounts
    if (!account.riotId || account.riotId.trim() === '') {
      account.riotId = account.label || account.username;
    }
    if (!account.tagline || account.tagline.trim() === '') {
      const reg = (account.region || 'EUW').toUpperCase();
      account.tagline = reg === 'EUW' ? 'EUW' : reg === 'EUNE' ? 'EUNE' : reg === 'NA' ? 'NA1' : reg;
    }

    // Only sync stats if Riot Client is actively running and matches this account
    try {
      const activeSession = await riotApiService.detectActiveSession();
      if (
        activeSession &&
        activeSession.riotId &&
        account.riotId &&
        activeSession.riotId.toLowerCase() === account.riotId.toLowerCase()
      ) {
        const realStats = await riotApiService.fetchAccountStats(account);
        if (realStats.valorantStats) {
          account.valorantStats = {
            ...(account.valorantStats || {}),
            ...realStats.valorantStats,
            vpBalance: realStats.valorantStats.vpBalance || account.valorantStats?.vpBalance || 0,
            radianiteBalance: realStats.valorantStats.radianiteBalance || account.valorantStats?.radianiteBalance || 0,
          };
        }
        if (realStats.leagueStats) {
          account.leagueStats = {
            ...(account.leagueStats || {}),
            ...realStats.leagueStats,
            beBalance: realStats.leagueStats.beBalance || account.leagueStats?.beBalance || 0,
            rpBalance: realStats.leagueStats.rpBalance || account.leagueStats?.rpBalance || 0,
            championsOwned: realStats.leagueStats.championsOwned || account.leagueStats?.championsOwned || 0,
            skinsOwned: realStats.leagueStats.skinsOwned || account.leagueStats?.skinsOwned || 0,
          };
        }
      }
    } catch {}

    if (!account.valorantStats) account.valorantStats = riotApiService.getCleanDefaultValorantStats();
    if (!account.leagueStats) account.leagueStats = riotApiService.getCleanDefaultLeagueStats();

    storageService.saveAccount(account, password);
    updateTrayMenu();
    return account;
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

  ipcMain.handle('launcher:force-logout', async () => {
    return launcherService.forceLogoutRiotClient();
  });

  ipcMain.handle('riot:refresh-stats', async (_event, account: RiotAccount) => {
    if (!account || !account.id) throw new Error('Invalid account');
    const accounts = storageService.getAccounts();
    const idx = accounts.findIndex(a => a.id === account.id);
    const existing = idx >= 0 ? accounts[idx] : account;

    const stats = await riotApiService.fetchAccountStats(existing);
    if (idx >= 0) {
      if (stats.valorantStats) {
        const curVal = accounts[idx].valorantStats;
        accounts[idx].valorantStats = {
          ...(curVal || {}),
          ...stats.valorantStats,
          accountLevel:
            (stats.valorantStats.accountLevel && stats.valorantStats.accountLevel > 1)
              ? stats.valorantStats.accountLevel
              : (curVal?.accountLevel || 1),
          rank:
            stats.valorantStats.rank !== 'Unranked'
              ? stats.valorantStats.rank
              : (curVal?.rank || 'Unranked'),
          vpBalance: stats.valorantStats.vpBalance || curVal?.vpBalance || 0,
          radianiteBalance: stats.valorantStats.radianiteBalance || curVal?.radianiteBalance || 0,
        };
      }
      if (stats.leagueStats) {
        const curLol = accounts[idx].leagueStats;
        accounts[idx].leagueStats = {
          ...(curLol || {}),
          ...stats.leagueStats,
          summonerLevel:
            (stats.leagueStats.summonerLevel && stats.leagueStats.summonerLevel > 1)
              ? stats.leagueStats.summonerLevel
              : (curLol?.summonerLevel || 1),
          soloRank:
            stats.leagueStats.soloRank !== 'Unranked'
              ? stats.leagueStats.soloRank
              : (curLol?.soloRank || 'Unranked'),
          soloLp: stats.leagueStats.soloLp || curLol?.soloLp || 0,
          beBalance: stats.leagueStats.beBalance || curLol?.beBalance || 0,
          rpBalance: stats.leagueStats.rpBalance || curLol?.rpBalance || 0,
        };
      }
      storageService.saveAccounts(accounts);
      return {
        valorantStats: accounts[idx].valorantStats,
        leagueStats: accounts[idx].leagueStats,
      };
    }
    return stats;
  });

  ipcMain.handle('riot:detect-current-session', async () => {
    const session = await riotApiService.detectActiveSession();
    if (session) {
      const accounts = storageService.getAccounts();
      const match = accounts.find(a =>
        (a.riotId && session.riotId && a.riotId.toLowerCase() === session.riotId.toLowerCase()) ||
        (a.username && session.username && a.username.toLowerCase() === session.username.toLowerCase())
      );
      if (match) {
        storageService.saveAccountSession(match.id);
      }
    }
    return session;
  });

  ipcMain.handle('session:capture', async (_event, accountId: string) => {
    if (typeof accountId !== 'string' || !accountId) return false;
    return storageService.saveAccountSession(accountId);
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

  // Background active session auto-snapshot every 15 seconds
  setInterval(async () => {
    try {
      const active = await riotApiService.detectActiveSession();
      if (active) {
        const accounts = storageService.getAccounts();
        const match = accounts.find((a) =>
          (a.riotId && active.riotId && a.riotId.toLowerCase() === active.riotId.toLowerCase()) ||
          (a.username && active.username && a.username.toLowerCase() === active.username.toLowerCase())
        );
        if (match) {
          storageService.saveAccountSession(match.id);
        }
      }
    } catch {}
  }, 15000);

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
