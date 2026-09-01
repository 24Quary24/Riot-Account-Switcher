import { contextBridge, ipcRenderer } from 'electron';
import { RiotAccount, AppSettings, PingResult, ValorantStats, LeagueStats, Region } from './types';

export interface RiotManagerApi {
  getAccounts: () => Promise<RiotAccount[]>;
  saveAccount: (account: RiotAccount, password?: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  launchAccount: (accountId: string, game: 'valorant' | 'league') => Promise<{ success: boolean; message: string }>;
  refreshAccountStats: (account: RiotAccount) => Promise<{ valorantStats?: ValorantStats; leagueStats?: LeagueStats }>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  selectRiotClientPath: () => Promise<string | null>;
  exportAccounts: (passphrase: string) => Promise<string>;
  importAccounts: (bundleJson: string, passphrase: string) => Promise<{ importedCount: number }>;
  pingRegions: () => Promise<PingResult[]>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  detectActiveSession: () => Promise<{ riotId: string; tagline: string; puuid: string; region?: Region } | null>;
  onLaunchStatus: (callback: (status: string) => void) => () => void;
}

const api: RiotManagerApi = {
  getAccounts: () => ipcRenderer.invoke('accounts:get'),
  saveAccount: (account, password) => ipcRenderer.invoke('accounts:save', account, password),
  deleteAccount: (id) => ipcRenderer.invoke('accounts:delete', id),
  launchAccount: (accountId, game) => ipcRenderer.invoke('launcher:launch', accountId, game),
  refreshAccountStats: (account) => ipcRenderer.invoke('riot:refresh-stats', account),
  detectActiveSession: () => ipcRenderer.invoke('riot:detect-current-session'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  selectRiotClientPath: () => ipcRenderer.invoke('settings:select-path'),
  exportAccounts: (passphrase) => ipcRenderer.invoke('vault:export', passphrase),
  importAccounts: (bundleJson, passphrase) => ipcRenderer.invoke('vault:import', bundleJson, passphrase),
  pingRegions: () => ipcRenderer.invoke('ping:all'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onLaunchStatus: (callback) => {
    const handler = (_event: any, status: string) => callback(status);
    ipcRenderer.on('launcher:status', handler);
    return () => ipcRenderer.removeListener('launcher:status', handler);
  },
};

contextBridge.exposeInMainWorld('riotManagerApi', api);
