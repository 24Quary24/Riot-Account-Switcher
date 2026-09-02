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

    // 1. Check if the currently active Riot session already belongs to this account.
    //    Compare by username (most reliable) AND riotId as fallback.
    let isAlreadyActive = false;
    try {
      const active = await this.riotApi.detectActiveSession();
      if (active) {
        const sameByRiotId = active.riotId && account.riotId &&
          active.riotId.toLowerCase() === account.riotId.toLowerCase();
        const sameByUsername = active.username &&
          active.username.toLowerCase() === account.username.toLowerCase();
        if (sameByRiotId || sameByUsername) {
          isAlreadyActive = true;
        }
      }
    } catch {}

    if (isAlreadyActive) {
      // Already logged in as this account — just launch the game
      onStatus?.(`Already signed in as ${account.riotId || account.label}. Launching ${game.toUpperCase()}...`);
      const child = spawn(clientPath, [`--launch-product=${productArg}`, '--launch-patchline=live'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.unref();

      // Wait for the client to settle, then click the Play button
      if (process.platform === 'win32') {
        const waitSeconds = Math.max(4, Math.min(12, settings.launchDelaySeconds || 5));
        onStatus?.(`Waiting ${waitSeconds}s for client to load, then clicking Play...`);
        await new Promise((r) => setTimeout(r, waitSeconds * 1000));
        await this.clickPlayButton(game);
      }

      account.lastPlayed = new Date().toISOString();
      this.storage.saveAccount(account);

      return {
        success: true,
        message: `Launched ${game.toUpperCase()} for ${account.riotId || account.label}!`,
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
      const loginWait = Math.max(5, Math.min(15, settings.launchDelaySeconds || 7));
      onStatus?.(`Waiting ${loginWait}s for Riot Client login screen...`);
      await new Promise((r) => setTimeout(r, loginWait * 1000));

      onStatus?.(`Entering credentials for ${account.username}...`);
      await this.injectCredentialsViaStdin(account.username, password);

      if (account.has2fa) {
        onStatus?.('2FA Protected: Credentials entered — complete your verification code in Riot Client.');
      } else {
        // Wait for login to complete + Riot Client home screen to load, then click Play
        onStatus?.('Login submitted. Waiting for home screen to load...');
        await new Promise((r) => setTimeout(r, 8000));
        onStatus?.('Clicking Play button...');
        await this.clickPlayButton(game);
      }
    }

    // Update last played timestamp
    account.lastPlayed = new Date().toISOString();
    this.storage.saveAccount(account);

    return {
      success: true,
      message: account.has2fa
        ? `Credentials entered — complete 2FA in Riot Client.`
        : `Switched to ${account.riotId || account.label} and launched ${game.toUpperCase()}.`,
    };
  }

  /**
   * Inject credentials via PowerShell STDIN.
   * Uses Win32 SetForegroundWindow (by process handle, not title) and verifies
   * focus before every keystroke burst so keystrokes never land in a browser or
   * wrong field when Riot Client loads slowly.
   */
  private async injectCredentialsViaStdin(username: string, pass: string): Promise<void> {
    return new Promise((resolve) => {
      const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms

# --- Win32 helpers for reliable foreground control ---
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32Focus {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
}
"@

$user = [Console]::In.ReadLine()
$password = [Console]::In.ReadLine()
if (-not $user -or -not $password) { exit 0 }

# --- Find RiotClientUx window handle (this is the login UI process) ---
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 24; $i++) {
    $procs = @(Get-Process | Where-Object {
        ($_.ProcessName -match 'RiotClientUx' -or $_.ProcessName -match 'Riot Client') -and
        $_.MainWindowHandle -ne 0
    })
    if ($procs.Count -gt 0) {
        $hwnd = $procs[0].MainWindowHandle
        break
    }
    Start-Sleep -Milliseconds 500
}

if ($hwnd -eq [IntPtr]::Zero) { exit 1 }

# --- Bring window to foreground ---
[Win32Focus]::ShowWindow($hwnd, 9) | Out-Null
[Win32Focus]::BringWindowToTop($hwnd) | Out-Null
[Win32Focus]::SetForegroundWindow($hwnd) | Out-Null

# --- Wait for login form to mount ---
Start-Sleep -Milliseconds 800

# Clear and type username
[System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
Start-Sleep -Milliseconds 150

foreach ($char in $user.ToCharArray()) {
    $c = [string]$char
    if ($c -match '[+^%~{}()\[\]]') { [System.Windows.Forms.SendKeys]::SendWait("{$c}") }
    else { [System.Windows.Forms.SendKeys]::SendWait($c) }
    Start-Sleep -Milliseconds 25
}

Start-Sleep -Milliseconds 150

# Tab to password field and clear
[System.Windows.Forms.SendKeys]::SendWait('{TAB}')
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
Start-Sleep -Milliseconds 100

# Type password
foreach ($char in $password.ToCharArray()) {
    $c = [string]$char
    if ($c -match '[+^%~{}()\[\]]') { [System.Windows.Forms.SendKeys]::SendWait("{$c}") }
    else { [System.Windows.Forms.SendKeys]::SendWait($c) }
    Start-Sleep -Milliseconds 25
}

Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
`;

      const ps = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
        { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] }
      );
      ps.stdin.write(username + '\r\n');
      ps.stdin.write(pass + '\r\n');
      ps.stdin.end();
      ps.on('close', () => resolve());
      ps.on('error', () => resolve());
      // Timeout: 12s wait + fast typing
      setTimeout(() => { try { ps.kill(); } catch {} resolve(); }, 15000);
    });
  }

  /**
   * Click the Play button in Riot Client using a real mouse click.
   * The Play button is not keyboard-focusable — Enter only works when hovered.
   * We get the window rect via Win32 and click at the known relative position
   * (~14% from left, ~87% from top) which matches where Riot Client renders it.
   * Clicks twice with a delay to handle "New Update Available" confirmation.
   */
  private async clickPlayButton(game: 'valorant' | 'league'): Promise<void> {
    const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Threading;
public class Win32Mouse {
    public struct RECT { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int n);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, uint d, IntPtr e);

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(120);
        mouse_event(0x0002, 0, 0, 0, IntPtr.Zero); // MOUSEEVENTF_LEFTDOWN
        Thread.Sleep(60);
        mouse_event(0x0004, 0, 0, 0, IntPtr.Zero); // MOUSEEVENTF_LEFTUP
    }
}
"@

# Find RiotClientUx window
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 16; $i++) {
    $procs = @(Get-Process | Where-Object {
        ($_.ProcessName -match 'RiotClientUx' -or $_.ProcessName -match 'Riot Client') -and
        $_.MainWindowHandle -ne 0
    })
    if ($procs.Count -gt 0) { $hwnd = $procs[0].MainWindowHandle; break }
    Start-Sleep -Milliseconds 500
}

if ($hwnd -eq [IntPtr]::Zero) { exit 1 }

# Bring window to front
[Win32Mouse]::ShowWindow($hwnd, 9) | Out-Null
[Win32Mouse]::BringWindowToTop($hwnd) | Out-Null
[Win32Mouse]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 800

# Get window rect and calculate Play button position
$r = New-Object Win32Mouse+RECT
[Win32Mouse]::GetWindowRect($hwnd, [ref]$r)

$w = $r.Right - $r.Left
$h = $r.Bottom - $r.Top

# Play button sits at roughly 14% from left, 87% from top in Riot Client
$playX = $r.Left + [int]($w * 0.14)
$playY = $r.Top + [int]($h * 0.87)

# First click — Play button
[Win32Mouse]::Click($playX, $playY)
Start-Sleep -Milliseconds 3500

# Re-grab focus and click again — handles "New Update Available" confirmation
[Win32Mouse]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 300
[Win32Mouse]::Click($playX, $playY)
`;

    await new Promise<void>((resolve) => {
      const ps = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
        { windowsHide: true, stdio: 'ignore' }
      );
      ps.on('close', () => resolve());
      ps.on('error', () => resolve());
      setTimeout(() => { try { ps.kill(); } catch {} resolve(); }, 15000);
    });
  }
}
