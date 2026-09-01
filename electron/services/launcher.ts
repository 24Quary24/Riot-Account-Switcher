import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { StorageService } from './storage';
import { RiotApiService } from './riotApi';

export class LauncherService {
  private storage: StorageService;
  private riotApi: RiotApiService;

  constructor(storage: StorageService, riotApi: RiotApiService) {
    this.storage = storage;
    this.riotApi = riotApi;
  }

  /**
   * Find Riot Client executable path. Checks settings, default path, and alternate drive letters.
   */
  public findRiotClientPath(): string {
    const settings = this.storage.getSettings();
    if (settings.customPathEnabled && settings.riotClientPath && fs.existsSync(settings.riotClientPath)) {
      return settings.riotClientPath;
    }

    const candidatePaths = [
      'C:\\Riot Games\\Riot Client\\RiotClientServices.exe',
      'D:\\Riot Games\\Riot Client\\RiotClientServices.exe',
      'E:\\Riot Games\\Riot Client\\RiotClientServices.exe',
      'C:\\Program Files\\Riot Games\\Riot Client\\RiotClientServices.exe',
      'C:\\Program Files (x86)\\Riot Games\\Riot Client\\RiotClientServices.exe',
    ];

    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return settings.riotClientPath;
  }

  /**
   * Gracefully terminate running Riot and League/Valorant processes safely.
   * Also deletes active session on Riot Client so it resets to the login screen.
   */
  public async closeRunningClients(): Promise<void> {
    if (process.platform !== 'win32') return;

    // 1. If Riot Client is active, call DELETE /rso-auth/v1/session to log out cleanly
    const lockfilePath = path.join(
      process.env.LOCALAPPDATA || '',
      'Riot Games',
      'Riot Client',
      'Config',
      'lockfile'
    );

    if (fs.existsSync(lockfilePath)) {
      try {
        const content = fs.readFileSync(lockfilePath, 'utf-8');
        const parts = content.split(':');
        if (parts.length >= 5) {
          const port = Number(parts[2]);
          const pass = parts[3];
          const auth = Buffer.from(`riot:${pass}`).toString('base64');
          await new Promise<void>((resolve) => {
            const req = https.request(
              {
                hostname: '127.0.0.1',
                port,
                path: '/rso-auth/v1/session',
                method: 'DELETE',
                headers: { Authorization: `Basic ${auth}` },
                rejectUnauthorized: false,
                timeout: 2000,
              },
              () => resolve()
            );
            req.on('error', () => resolve());
            req.on('timeout', () => {
              req.destroy();
              resolve();
            });
            req.end();
          });
        }
      } catch {}
    }

    // 2. Kill all processes including "Riot Client.exe"
    const processesToKill = [
      'Riot Client.exe',
      'RiotClientServices.exe',
      'RiotClientCrashHandler.exe',
      'RiotClientUx.exe',
      'RiotClientUxRender.exe',
      'LeagueClient.exe',
      'LeagueClientUx.exe',
      'LeagueClientUxRender.exe',
      'VALORANT.exe',
      'VALORANT-Win64-Shipping.exe',
    ];

    for (const proc of processesToKill) {
      try {
        await new Promise<void>((resolve) => {
          const killer = spawn('taskkill.exe', ['/F', '/IM', proc, '/T'], {
            windowsHide: true,
            stdio: 'ignore',
          });
          killer.on('close', () => resolve());
          killer.on('error', () => resolve());
        });
      } catch {}
    }

    // Allow OS file handles and sockets to release cleanly
    await new Promise((res) => setTimeout(res, 1200));
  }

  /**
   * Launch Riot Client and auto-fill credentials securely into login prompt.
   */
  public async launchAccount(
    accountId: string,
    game: 'valorant' | 'league',
    onStatus?: (status: string) => void
  ): Promise<{ success: boolean; message: string }> {
    // Validate inputs
    if (typeof accountId !== 'string' || !accountId) {
      throw new Error('Invalid account identifier');
    }
    if (game !== 'valorant' && game !== 'league') {
      throw new Error('Invalid game target');
    }

    const accounts = this.storage.getAccounts();
    const account = accounts.find((a) => a.id === accountId);
    if (!account) {
      throw new Error(`Account not found`);
    }

    const password = this.storage.getAccountPassword(account.username);
    if (!password) {
      throw new Error(`No credentials saved for ${account.username}. Please edit the account and re-enter the password.`);
    }

    const settings = this.storage.getSettings();
    const clientPath = this.findRiotClientPath();

    if (!fs.existsSync(clientPath)) {
      throw new Error(`Riot Client was not found at: ${clientPath}\nPlease specify the correct path in Settings.`);
    }

    const productArg = game === 'valorant' ? 'valorant' : 'league_of_legends';

    // 1. Check if the currently active Riot session already belongs to this account
    let isAlreadyActive = false;
    try {
      const active = await this.riotApi.detectActiveSession();
      if (active && active.riotId && account.riotId) {
        if (active.riotId.toLowerCase() === account.riotId.toLowerCase()) {
          isAlreadyActive = true;
        }
      }
    } catch {}

    if (isAlreadyActive) {
      onStatus?.(`Already signed in as ${account.riotId || account.label}. Starting ${game.toUpperCase()}...`);
      const child = spawn(clientPath, [`--launch-product=${productArg}`, '--launch-patchline=live'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.unref();

      account.lastPlayed = new Date().toISOString();
      this.storage.saveAccount(account);

      return {
        success: true,
        message: `Launched ${game.toUpperCase()} with active session ${account.riotId || account.label}!`,
      };
    }

    // 2. We need to switch accounts: log out previous session and terminate all instances
    onStatus?.('Switching accounts: logging out previous session...');
    await this.closeRunningClients();

    onStatus?.(`Opening Riot Client for ${account.label} (${game.toUpperCase()})...`);
    const launchArgs = [`--launch-product=${productArg}`, '--launch-patchline=live'];

    const child = spawn(clientPath, launchArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();

    // Auto-login automation via secure STDIN
    if (process.platform === 'win32') {
      const waitSeconds = Math.max(5, Math.min(15, settings.launchDelaySeconds || 6));
      onStatus?.(`Waiting ${waitSeconds}s for Riot Client login screen to load...`);
      await new Promise((r) => setTimeout(r, waitSeconds * 1000));

      onStatus?.(`Entering credentials for ${account.username}...`);
      await this.injectCredentialsViaStdin(account.username, password);

      if (account.has2fa) {
        onStatus?.('⚠️ 2FA Protected: Credentials entered! Enter your verification code in Riot Client.');
      }
    }

    // Update last played timestamp
    account.lastPlayed = new Date().toISOString();
    this.storage.saveAccount(account);

    return {
      success: true,
      message: account.has2fa
        ? `Credentials entered! Please approve the 2FA prompt in Riot Client.`
        : `Switched & launched ${game.toUpperCase()} with account: ${account.riotId || account.label}`,
    };
  }

  /**
   * Bank-grade secure automation:
   * Pass credentials strictly through PowerShell's STDIN pipe.
   * Uses paced typing cadence to ensure Chromium/Electron registers both username and password.
   */
  private async injectCredentialsViaStdin(username: string, pass: string): Promise<void> {
    return new Promise((resolve) => {
      // Secure PowerShell script that reads credentials line by line from STDIN
      const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic

# Read credentials from STDIN stream
$user = [Console]::In.ReadLine()
$password = [Console]::In.ReadLine()

if (-not $user -or -not $password) { exit 0 }

# 1. Locate and activate Riot Client window (retry up to 10 times)
for ($i = 0; $i -lt 10; $i++) {
    $activated = $false
    try {
        [Microsoft.VisualBasic.Interaction]::AppActivate("Riot Client")
        $activated = $true
    } catch {
        $procs = Get-Process | Where-Object { $_.ProcessName -match "Riot Client|RiotClient" }
        if ($procs) {
            foreach ($p in $procs) {
                try {
                    [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id)
                    $activated = $true
                    break
                } catch {}
            }
        }
    }
    if ($activated) { break }
    Start-Sleep -Milliseconds 500
}

# 2. Critical pause: Give Electron webview 1.5 seconds to mount and focus input
Start-Sleep -Milliseconds 1500

# 3. Focus and clear username field
[System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
Start-Sleep -Milliseconds 250

# 4. Type username with 35ms cadence so no characters are lost
foreach ($char in $user.ToCharArray()) {
    $cStr = [string]$char
    if ($cStr -match '[+^%~{}()\\[\\]]') {
        [System.Windows.Forms.SendKeys]::SendWait("{$cStr}")
    } else {
        [System.Windows.Forms.SendKeys]::SendWait($cStr)
    }
    Start-Sleep -Milliseconds 35
}

# 5. Pause before tabbing to password
Start-Sleep -Milliseconds 400

# 6. Tab to password field
[System.Windows.Forms.SendKeys]::SendWait('{TAB}')
Start-Sleep -Milliseconds 350

# Clear password field just in case
[System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
Start-Sleep -Milliseconds 200

# 7. Type password with 35ms cadence
foreach ($char in $password.ToCharArray()) {
    $cStr = [string]$char
    if ($cStr -match '[+^%~{}()\\[\\]]') {
        [System.Windows.Forms.SendKeys]::SendWait("{$cStr}")
    } else {
        [System.Windows.Forms.SendKeys]::SendWait($cStr)
    }
    Start-Sleep -Milliseconds 35
}

# 8. Pause before submitting
Start-Sleep -Milliseconds 450

# 9. Submit login
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
`;

      const psProcess = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
        {
          windowsHide: true,
          stdio: ['pipe', 'ignore', 'ignore'],
        }
      );

      // Write credentials into STDIN with Windows CRLF and close stream
      psProcess.stdin.write(username + '\r\n');
      psProcess.stdin.write(pass + '\r\n');
      psProcess.stdin.end();

      psProcess.on('close', () => resolve());
      psProcess.on('error', () => resolve());

      // Timeout safety guard
      setTimeout(() => {
        try {
          psProcess.kill();
        } catch {}
        resolve();
      }, 15000);
    });
  }
}
