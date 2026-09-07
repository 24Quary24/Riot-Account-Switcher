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
  private trustedDeviceFile: string;
  private fallbackKey: Buffer;

  constructor() {
    this.userDataDir = app ? app.getPath('userData') : path.join(process.cwd(), '.riot-manager-data');
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
    this.accountsFile = path.join(this.userDataDir, 'accounts.json');
    this.credentialsFile = path.join(this.userDataDir, 'credentials.vault');
    this.settingsFile = path.join(this.userDataDir, 'settings.json');
    this.trustedDeviceFile = path.join(this.userDataDir, 'trusted_device.yaml');

    // Create fallback machine-derived encryption key in case safeStorage is not available
    const machineId = process.env.COMPUTERNAME || 'RiotManagerFallbackSalt';
    this.fallbackKey = crypto.scryptSync(machineId, 'riot-vault-salt-2026', 32);

    // Automatically preserve 30-day 2FA trusted device ID on startup
    this.backupTrustedDevice();
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
      const accounts: RiotAccount[] = JSON.parse(raw);
      return accounts.map(a => ({
        ...a,
        hasSavedSession: this.hasSavedSession(a.id),
      }));
    } catch {
      return [];
    }
  }

  public saveAccounts(accounts: RiotAccount[]): void {
    // Strip ephemeral hasSavedSession before saving to accounts.json
    const cleaned = accounts.map(({ hasSavedSession, ...rest }) => rest);
    fs.writeFileSync(this.accountsFile, JSON.stringify(cleaned, null, 2), 'utf-8');
  }

  public saveAccount(account: RiotAccount, password?: string): void {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex(
      (a) => a.id === account.id || a.username.toLowerCase() === account.username.toLowerCase()
    );

    if (idx >= 0) {
      const existing = accounts[idx];
      // If the username was renamed during an edit:
      if (existing.username.toLowerCase() !== account.username.toLowerCase()) {
        const oldPassword = this.getAccountPassword(existing.username);
        this.deleteAccountPassword(existing.username);
        // If user didn't enter a new password, migrate the existing password to the new username
        if (!password && oldPassword) {
          this.storeAccountPassword(account.username, oldPassword);
        }
      }
      accounts[idx] = { ...existing, ...account };
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
    this.deleteAccountSession(id);
  }

  // --- Session Management (Silent Login & 2FA Trusted Device) ---
  public getSessionDir(accountId: string): string {
    const sessionDir = path.join(this.userDataDir, 'sessions', accountId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
  }

  /**
   * Helper to check whether YAML content represents an active authenticated Riot session.
   * Supports modern PSL (Player Security Layer id_token + refresh_token) and legacy formats.
   */
  public isRiotSessionActive(yamlContent: string): boolean {
    if (!yamlContent || typeof yamlContent !== 'string') return false;

    // 1. Modern PSL (Player Security Layer) session check:
    // Must have id_token and refresh_token under riot-client, and riot-client is not null
    const hasRiotClient = yamlContent.includes('riot-client:') && !yamlContent.includes('riot-client: null');
    const hasIdToken = yamlContent.includes('id_token:') && !yamlContent.includes('id_token: null') && !yamlContent.includes('id_token: ""');
    const hasRefreshToken = yamlContent.includes('refresh_token:') && !yamlContent.includes('refresh_token: null') && !yamlContent.includes('refresh_token: ""');
    if (hasRiotClient && hasIdToken && hasRefreshToken) {
      return true;
    }

    // 2. Legacy session check (older Riot Client versions):
    if (yamlContent.includes('riot-login:') && yamlContent.includes('persist:') && !yamlContent.includes('persist: null') && yamlContent.length > 200) {
      return true;
    }

    return false;
  }

  /**
   * Extract 30-day 2FA Trusted Device ID block (rso-authenticator: tdid) from YAML content.
   */
  public extractTdidBlock(yamlContent: string): string | null {
    if (!yamlContent || typeof yamlContent !== 'string') return null;
    const match = yamlContent.match(/rso-authenticator:\s*\r?\n\s+tdid:[\s\S]*?value:\s*"[^"]+"/);
    if (match) {
      return match[0].trim();
    }
    return null;
  }

  /**
   * Automatically preserve active 30-day 2FA trusted device ID to disk.
   */
  public backupTrustedDevice(yamlContent?: string): void {
    try {
      let tdidBlock: string | null = null;
      if (yamlContent) {
        tdidBlock = this.extractTdidBlock(yamlContent);
      } else {
        const riotDataDir = path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'Data');
        const yamlPath = path.join(riotDataDir, 'RiotGamesPrivateSettings.yaml');
        if (fs.existsSync(yamlPath)) {
          const raw = fs.readFileSync(yamlPath, 'utf-8');
          tdidBlock = this.extractTdidBlock(raw);
        }
      }

      if (tdidBlock) {
        fs.writeFileSync(this.trustedDeviceFile, tdidBlock, 'utf-8');
      }
    } catch (e) {
      console.warn('Could not backup trusted device ID:', e);
    }
  }

  /**
   * Retrieve preserved 30-day 2FA trusted device ID from disk or existing sessions.
   */
  public getSavedTrustedDevice(): string | null {
    try {
      if (fs.existsSync(this.trustedDeviceFile)) {
        const content = fs.readFileSync(this.trustedDeviceFile, 'utf-8');
        if (content && content.includes('tdid:') && content.includes('value:')) {
          return content.trim();
        }
      }

      // Check existing account sessions for a saved tdid
      const sessionsDir = path.join(this.userDataDir, 'sessions');
      if (fs.existsSync(sessionsDir)) {
        const subdirs = fs.readdirSync(sessionsDir);
        for (const sub of subdirs) {
          const p = path.join(sessionsDir, sub, 'RiotGamesPrivateSettings.yaml');
          if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf-8');
            const found = this.extractTdidBlock(raw);
            if (found) {
              this.backupTrustedDevice(raw);
              return found;
            }
          }
        }
      }
    } catch {}
    return null;
  }

  /**
   * Extract account metadata from the id_token JWT inside RiotGamesPrivateSettings.yaml.
   */
  public extractSessionAccountInfo(yamlContent: string): {
    username?: string;
    riotId?: string;
    tagline?: string;
    puuid?: string;
    has2fa?: boolean;
  } | null {
    if (!yamlContent) return null;
    const match = yamlContent.match(/id_token:\s*"([^"]+)"/);
    if (!match || !match[1]) return null;

    try {
      const parts = match[1].split('.');
      if (parts.length < 2) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
      const payload = JSON.parse(jsonStr);

      const username = payload.uname || payload.lol?.[0]?.uname;
      const riotId = payload.acct?.game_name;
      const tagline = payload.acct?.tag_line;
      const puuid = payload.sub;
      const has2fa = Boolean(payload.amr && Array.isArray(payload.amr) && payload.amr.includes('mfa'));

      return { username, riotId, tagline, puuid, has2fa };
    } catch {
      return null;
    }
  }

  /**
   * Parse active RiotGamesPrivateSettings.yaml on disk to detect which account is logged in,
   * even if Riot Client is closed or between launches.
   */
  public getActiveSessionAccount(): { id?: string; username?: string; riotId?: string; tagline?: string; has2fa?: boolean } | null {
    try {
      const riotDataDir = path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'Data');
      const yamlPath = path.join(riotDataDir, 'RiotGamesPrivateSettings.yaml');
      if (!fs.existsSync(yamlPath)) return null;

      const content = fs.readFileSync(yamlPath, 'utf-8');
      if (!this.isRiotSessionActive(content)) return null;

      const info = this.extractSessionAccountInfo(content);
      if (!info) return null;

      const accounts = this.getAccounts();
      const match = accounts.find((a) => {
        const matchUser = a.username && info.username && a.username.toLowerCase() === info.username.toLowerCase();
        const matchRiotId = a.riotId && info.riotId && a.riotId.toLowerCase() === info.riotId.toLowerCase();
        return matchUser || matchRiotId;
      });

      if (match) {
        let changed = false;
        if (info.has2fa && !match.has2fa) {
          match.has2fa = true;
          changed = true;
        }
        if (info.riotId && (!match.riotId || match.riotId === match.username)) {
          match.riotId = info.riotId;
          changed = true;
        }
        if (info.tagline && (!match.tagline || match.tagline === 'EUNE' || match.tagline === 'EUW')) {
          match.tagline = info.tagline;
          changed = true;
        }
        if (changed) {
          this.saveAccount(match);
        }
        return { id: match.id, ...info };
      }

      return { ...info };
    } catch {
      return null;
    }
  }

  public hasSavedSession(accountId: string): boolean {
    const sessionDir = path.join(this.userDataDir, 'sessions', accountId);
    const yamlPath = path.join(sessionDir, 'RiotGamesPrivateSettings.yaml');
    if (!fs.existsSync(yamlPath)) return false;
    try {
      const content = fs.readFileSync(yamlPath, 'utf-8');
      return this.isRiotSessionActive(content);
    } catch {
      return false;
    }
  }

  public saveAccountSession(accountId: string): boolean {
    try {
      const riotDataDir = path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'Data');
      const yamlPath = path.join(riotDataDir, 'RiotGamesPrivateSettings.yaml');
      if (!fs.existsSync(yamlPath)) return false;

      const content = fs.readFileSync(yamlPath, 'utf-8');
      if (!this.isRiotSessionActive(content)) {
        return false;
      }

      // Preserve 30-day 2FA trusted device ID so 2FA is never re-prompted
      this.backupTrustedDevice(content);

      const sessionDir = this.getSessionDir(accountId);
      fs.copyFileSync(yamlPath, path.join(sessionDir, 'RiotGamesPrivateSettings.yaml'));

      const sessionsSrc = path.join(riotDataDir, 'Sessions');
      const sessionsDest = path.join(sessionDir, 'Sessions');
      if (fs.existsSync(sessionsSrc)) {
        try {
          if (fs.existsSync(sessionsDest)) {
            fs.rmSync(sessionsDest, { recursive: true, force: true });
          }
          fs.cpSync(sessionsSrc, sessionsDest, { recursive: true });
        } catch (e) {
          console.warn(`Sessions dir copy warning for ${accountId}:`, e);
        }
      }

      console.log(`[SESSION] Successfully saved persistent session for account ${accountId}`);
      return true;
    } catch (err) {
      console.error(`Failed to save session for ${accountId}:`, err);
      return false;
    }
  }

  public restoreAccountSession(accountId: string): boolean {
    try {
      if (!this.hasSavedSession(accountId)) return false;

      const sessionDir = path.join(this.userDataDir, 'sessions', accountId);
      const yamlSrc = path.join(sessionDir, 'RiotGamesPrivateSettings.yaml');
      let content = fs.readFileSync(yamlSrc, 'utf-8');

      // If the saved session YAML does not have a tdid block, but we have a trusted device backup:
      // inject the tdid block so 2FA is never required!
      if (!this.extractTdidBlock(content)) {
        const backupTdid = this.getSavedTrustedDevice();
        if (backupTdid) {
          content = content.trimEnd() + '\n' + backupTdid + '\n';
        }
      }

      const riotDataDir = path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'Data');
      if (!fs.existsSync(riotDataDir)) {
        fs.mkdirSync(riotDataDir, { recursive: true });
      }

      const yamlDest = path.join(riotDataDir, 'RiotGamesPrivateSettings.yaml');
      fs.writeFileSync(yamlDest, content, 'utf-8');

      // 2. Restore Sessions directory
      const sessionsSrc = path.join(sessionDir, 'Sessions');
      const sessionsDest = path.join(riotDataDir, 'Sessions');
      if (fs.existsSync(sessionsSrc)) {
        try {
          if (fs.existsSync(sessionsDest)) {
            fs.rmSync(sessionsDest, { recursive: true, force: true });
          }
          fs.cpSync(sessionsSrc, sessionsDest, { recursive: true });
        } catch (e) {
          console.warn(`Sessions dir restore warning for ${accountId}:`, e);
        }
      }

      // 3. Clear any stale lockfile
      const lockfilePath = path.join(
        process.env.LOCALAPPDATA || '',
        'Riot Games',
        'Riot Client',
        'Config',
        'lockfile'
      );
      if (fs.existsSync(lockfilePath)) {
        try {
          fs.unlinkSync(lockfilePath);
        } catch {}
      }

      console.log(`[SESSION] Successfully restored persistent session for account ${accountId}`);
      return true;
    } catch (err) {
      console.error(`Failed to restore session for ${accountId}:`, err);
      return false;
    }
  }

  public deleteAccountSession(accountId: string): void {
    try {
      const sessionDir = path.join(this.userDataDir, 'sessions', accountId);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch {}
  }

  /**
   * Checks whether the current Riot Client on disk has an active authenticated session.
   */
  public isCurrentRiotSessionActive(): boolean {
    try {
      const riotDataDir = path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'Data');
      const yamlPath = path.join(riotDataDir, 'RiotGamesPrivateSettings.yaml');
      if (!fs.existsSync(yamlPath)) return false;
      const content = fs.readFileSync(yamlPath, 'utf-8');
      return this.isRiotSessionActive(content);
    } catch {
      return false;
    }
  }

  /**
   * Resets the active Riot Client session on disk to forced logged-out state.
   * This guarantees that when Riot Client starts, it CANNOT resume the old account
   * and is forced to display the clean login screen.
   *
   * CRITICAL FIX: PRESERVES the 30-day 2FA Trusted Device token (tdid) so that
   * switching accounts or logging out NEVER revokes your 30-day "Remember this device" trust!
   */
  public wipeCurrentRiotSession(): boolean {
    try {
      const riotDataDir = path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'Data');
      if (!fs.existsSync(riotDataDir)) {
        fs.mkdirSync(riotDataDir, { recursive: true });
      }

      const yamlPath = path.join(riotDataDir, 'RiotGamesPrivateSettings.yaml');

      // 1. Extract existing tdid before wiping, or use trusted_device backup
      let tdidBlock: string | null = null;
      if (fs.existsSync(yamlPath)) {
        try {
          const existingContent = fs.readFileSync(yamlPath, 'utf-8');
          tdidBlock = this.extractTdidBlock(existingContent);
          if (tdidBlock) {
            this.backupTrustedDevice(existingContent);
          }
        } catch {}
      }
      if (!tdidBlock) {
        tdidBlock = this.getSavedTrustedDevice();
      }

      // 2. Clear authorization tokens to force clean login screen, BUT PRESERVE TDID SO 2FA IS NOT RE-PROMPTED!
      let loggedOutYaml = `psl:\n    authorization:\n        riot-client: null\nriot-login:\n    persist: null\n`;
      if (tdidBlock) {
        loggedOutYaml += `${tdidBlock}\n`;
      }
      fs.writeFileSync(yamlPath, loggedOutYaml, 'utf-8');

      // 3. Wipe Sessions directory
      const sessionsDir = path.join(riotDataDir, 'Sessions');
      if (fs.existsSync(sessionsDir)) {
        try {
          fs.rmSync(sessionsDir, { recursive: true, force: true });
          fs.mkdirSync(sessionsDir, { recursive: true });
        } catch {}
      }

      // 4. Remove stale lockfile if any
      const lockfilePath = path.join(
        process.env.LOCALAPPDATA || '',
        'Riot Games',
        'Riot Client',
        'Config',
        'lockfile'
      );
      if (fs.existsSync(lockfilePath)) {
        try { fs.unlinkSync(lockfilePath); } catch {}
      }

      return true;
    } catch (err) {
      console.error('Failed to wipe active Riot session:', err);
      return false;
    }
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
