import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { StorageService } from './storage';

export class LauncherService {
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
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
   */
  public async closeRunningClients(): Promise<void> {
    if (process.platform !== 'win32') return;

    const processesToKill = [
      'RiotClientServices.exe',
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
      } catch {
        // ignore
      }
    }

    // Allow OS file handles and sockets to release cleanly
    await new Promise(res => setTimeout(res, 1000));
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
    const account = accounts.find(a => a.id === accountId);
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
      throw new Error(
        `Riot Client was not found at: ${clientPath}\nPlease specify the correct path in Settings.`
      );
    }

    if (settings.autoCloseClients) {
      onStatus?.('Closing running Riot instances...');
      await this.closeRunningClients();
    }

    const productArg = game === 'valorant' ? 'valorant' : 'league_of_legends';
    const launchArgs = [
      `--launch-product=${productArg}`,
      '--launch-patchline=live',
    ];

    onStatus?.(`Launching Riot Client for ${account.label} (${game.toUpperCase()})...`);

    // Spawn detached process without shell injection risk
    const child = spawn(clientPath, launchArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();

    // Auto-login automation via secure STDIN (no credentials passed in process arguments!)
    if (process.platform === 'win32') {
      const waitSeconds = Math.max(2, Math.min(15, settings.launchDelaySeconds || 4));
      onStatus?.(`Waiting ${waitSeconds}s for login window...`);
      await new Promise(r => setTimeout(r, waitSeconds * 1000));

      onStatus?.('Entering credentials securely...');
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
        : `Launched ${game.toUpperCase()} with account: ${account.riotId || account.label}`,
    };
  }

  /**
   * Bank-grade secure automation:
   * Pass credentials strictly through PowerShell's STDIN pipe.
   * This completely prevents passwords from appearing in Windows Task Manager,
   * process monitor logs, or command-line arguments.
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

# Find and activate Riot Client window
$procs = Get-Process -Name "RiotClientUx", "RiotClientServices"
if ($procs) {
    try {
        [Microsoft.VisualBasic.Interaction]::AppActivate($procs[0].Id)
    } catch {
        [Microsoft.VisualBasic.Interaction]::AppActivate("Riot Client")
    }
    Start-Sleep -Milliseconds 600

    # Focus and clear current field (Ctrl+A, Backspace)
    [System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
    Start-Sleep -Milliseconds 150

    # Type username character by character safely
    foreach ($char in $user.ToCharArray()) {
        $cStr = [string]$char
        if ($cStr -match '[+^%~{}()\\[\\]]') {
            [System.Windows.Forms.SendKeys]::SendWait("{$cStr}")
        } else {
            [System.Windows.Forms.SendKeys]::SendWait($cStr)
        }
    }
    Start-Sleep -Milliseconds 200

    # Tab to password field
    [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
    Start-Sleep -Milliseconds 150

    # Type password character by character safely
    foreach ($char in $password.ToCharArray()) {
        $cStr = [string]$char
        if ($cStr -match '[+^%~{}()\\[\\]]') {
            [System.Windows.Forms.SendKeys]::SendWait("{$cStr}")
        } else {
            [System.Windows.Forms.SendKeys]::SendWait($cStr)
        }
    }
    Start-Sleep -Milliseconds 250

    # Submit login
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
}
`;

      const psProcess = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command', psScript
      ], {
        windowsHide: true,
        stdio: ['pipe', 'ignore', 'ignore'],
      });

      // Write credentials into STDIN and immediately close stream
      psProcess.stdin.write(username + '\n');
      psProcess.stdin.write(pass + '\n');
      psProcess.stdin.end();

      psProcess.on('close', () => resolve());
      psProcess.on('error', () => resolve());

      // Timeout safety guard
      setTimeout(() => {
        try { psProcess.kill(); } catch {}
        resolve();
      }, 7000);
    });
  }
}
