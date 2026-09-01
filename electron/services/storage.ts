import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { RiotAccount, AppSettings } from '../types';

export interface StoredCredential {
  username: string;
  encryptedPassword: string; // Base64 safeStorage or fallback AES
}

const DEFAULT_SETTINGS: AppSettings = {
  riotClientPath: 'C:\\Riot Games\\Riot Client\\RiotClientServices.exe',
  customPathEnabled: false,
  riotApiKey: '',
  autoCloseClients: true,
  autoLaunchGame: true,
  launchDelaySeconds: 4,
  minimizeToTray: true,
  startMinimized: false,
  theme: 'dark',
  soundEffects: true,
};

export class StorageService {
  private userDataDir: string;
  private accountsFile: string;
  private credentialsFile: string;
  private settingsFile: string;
  private fallbackKey: Buffer;

  constructor() {
    this.userDataDir = app ? app.getPath('userData') : path.join(process.cwd(), '.riot-manager-data');
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
    this.accountsFile = path.join(this.userDataDir, 'accounts.json');
    this.credentialsFile = path.join(this.userDataDir, 'credentials.vault');
    this.settingsFile = path.join(this.userDataDir, 'settings.json');

    // Create fallback machine-derived encryption key in case safeStorage is not available
    const machineId = process.env.COMPUTERNAME || 'RiotManagerFallbackSalt';
    this.fallbackKey = crypto.scryptSync(machineId, 'riot-vault-salt-2026', 32);
  }

  // --- Secure Password Encryption ---
  public encryptPassword(plainText: string): string {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(plainText);
      return `safe:${buffer.toString('base64')}`;
    }

    // Fallback AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.fallbackKey, iv);
    let enc = cipher.update(plainText, 'utf8', 'base64');
    enc += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    return `aes:${iv.toString('base64')}:${authTag}:${enc}`;
  }

  public decryptPassword(encryptedStr: string): string {
    if (encryptedStr.startsWith('safe:')) {
      const base64Data = encryptedStr.replace('safe:', '');
      const buffer = Buffer.from(base64Data, 'base64');
      return safeStorage.decryptString(buffer);
    }

    if (encryptedStr.startsWith('aes:')) {
      const [, ivB64, tagB64, dataB64] = encryptedStr.split(':');
      const iv = Buffer.from(ivB64, 'base64');
      const authTag = Buffer.from(tagB64, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.fallbackKey, iv);
      decipher.setAuthTag(authTag);
      let dec = decipher.update(dataB64, 'base64', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    }

    // Legacy plain text fallback if any
    return encryptedStr;
  }

  // --- Credentials Vault ---
  private loadCredentials(): Record<string, string> {
    if (!fs.existsSync(this.credentialsFile)) return {};
    try {
      const raw = fs.readFileSync(this.credentialsFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private saveCredentials(creds: Record<string, string>): void {
    fs.writeFileSync(this.credentialsFile, JSON.stringify(creds, null, 2), { encoding: 'utf-8', mode: 0o600 });
  }

  public storeAccountPassword(username: string, plainTextPass: string): void {
    const creds = this.loadCredentials();
    creds[username.toLowerCase()] = this.encryptPassword(plainTextPass);
    this.saveCredentials(creds);
  }

  public getAccountPassword(username: string): string | null {
    const creds = this.loadCredentials();
    const enc = creds[username.toLowerCase()];
    if (!enc) return null;
    try {
      return this.decryptPassword(enc);
    } catch (e) {
      console.error(`Failed to decrypt password for ${username}:`, e);
      return null;
    }
  }

  public deleteAccountPassword(username: string): void {
    const creds = this.loadCredentials();
    delete creds[username.toLowerCase()];
    this.saveCredentials(creds);
  }

  // --- Accounts Metadata ---
  public getAccounts(): RiotAccount[] {
    if (!fs.existsSync(this.accountsFile)) return [];
    try {
      const raw = fs.readFileSync(this.accountsFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public saveAccounts(accounts: RiotAccount[]): void {
    fs.writeFileSync(this.accountsFile, JSON.stringify(accounts, null, 2), 'utf-8');
  }

  public saveAccount(account: RiotAccount, password?: string): void {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex(a => a.id === account.id || a.username.toLowerCase() === account.username.toLowerCase());
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], ...account };
    } else {
      accounts.push(account);
    }
    this.saveAccounts(accounts);

    if (password) {
      this.storeAccountPassword(account.username, password);
    }
  }

  public deleteAccount(id: string): void {
    const accounts = this.getAccounts();
    const target = accounts.find(a => a.id === id);
    if (target) {
      this.deleteAccountPassword(target.username);
    }
    const filtered = accounts.filter(a => a.id !== id);
    this.saveAccounts(filtered);
  }

  // --- Settings ---
  public getSettings(): AppSettings {
    if (!fs.existsSync(this.settingsFile)) return { ...DEFAULT_SETTINGS };
    try {
      const raw = fs.readFileSync(this.settingsFile, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  public saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(this.settingsFile, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  // --- Encrypted Export & Import ---
  public exportEncryptedAccounts(passphrase: string): string {
    const accounts = this.getAccounts();
    const creds = this.loadCredentials();

    const exportPayload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      accounts,
      credentials: Object.entries(creds).reduce((acc, [user, encPass]) => {
        try {
          acc[user] = this.decryptPassword(encPass);
        } catch {
          // ignore
        }
        return acc;
      }, {} as Record<string, string>),
    };

    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const jsonStr = JSON.stringify(exportPayload);
    let encrypted = cipher.update(jsonStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    const result = {
      magic: 'RIOT_MGR_VAULT',
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag,
      payload: encrypted,
    };

    return JSON.stringify(result, null, 2);
  }

  public importEncryptedAccounts(encryptedBundleJson: string, passphrase: string): { importedCount: number } {
    const bundle = JSON.parse(encryptedBundleJson);
    if (bundle.magic !== 'RIOT_MGR_VAULT') {
      throw new Error('Invalid file format or corrupted backup file.');
    }

    const salt = Buffer.from(bundle.salt, 'base64');
    const iv = Buffer.from(bundle.iv, 'base64');
    const authTag = Buffer.from(bundle.authTag, 'base64');
    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(bundle.payload, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    const parsed = JSON.parse(decrypted);
    const incomingAccounts: RiotAccount[] = parsed.accounts || [];
    const incomingCreds: Record<string, string> = parsed.credentials || {};

    let importedCount = 0;
    for (const acc of incomingAccounts) {
      const password = incomingCreds[acc.username.toLowerCase()];
      this.saveAccount(acc, password);
      importedCount++;
    }

    return { importedCount };
  }
}
