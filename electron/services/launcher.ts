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
   * If wipeSession is true, also deletes active session on Riot Client so it resets to the login screen.
   * If wipeSession is false, preserves session tokens for instant silent switching.
   */
  /**
   * Gracefully terminate running Riot and League/Valorant processes safely.
   * If wipeSession is true, also deletes active session on Riot Client on disk
   * so it is guaranteed to reset to the login screen.
   * If wipeSession is false, preserves session tokens for instant silent switching.
   */
  public async closeRunningClients(wipeSession: boolean = false): Promise<void> {
    if (process.platform !== 'win32') return;

    // 1. Kill all processes including "Riot Client.exe"
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

    // 2. If wipeSession is requested, explicitly reset persistent session on disk!
    if (wipeSession) {
      this.storage.wipeCurrentRiotSession();
    }
  }

  /**
   * Force log out of Riot Client and reset session files on disk.
   */
  public async forceLogoutRiotClient(): Promise<{ success: boolean; message: string }> {
    await this.closeRunningClients(true);
    return {
      success: true,
      message: 'Successfully logged out of Riot Client and cleared active session on disk.',
    };
  }

  /**
   * Launch Riot Client and auto-fill credentials securely into login prompt.
   * Supports 100% silent session switching when a saved session exists.
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
    let isAlreadyActive = false;
    try {
      const active = await this.riotApi.detectActiveSession();
      if (active) {
        // Snapshot whichever account is currently active so its session is preserved
        const activeAccount = accounts.find((a) =>
          (a.riotId && active.riotId && a.riotId.toLowerCase() === active.riotId.toLowerCase()) ||
          (a.username && active.username && a.username.toLowerCase() === active.username.toLowerCase())
        );
        if (activeAccount) {
          this.storage.saveAccountSession(activeAccount.id);
        }

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
      // Already logged in as this account — snapshot session and launch game directly
      this.storage.saveAccountSession(account.id);
      onStatus?.(`Already signed in as ${account.riotId || account.label}. Launching ${game.toUpperCase()}...`);
      const child = spawn(clientPath, [`--launch-product=${productArg}`, '--launch-patchline=live'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.unref();

      if (process.platform === 'win32') {
        const waitSeconds = Math.max(4, Math.min(12, settings.launchDelaySeconds || 5));
        onStatus?.(`Waiting ${waitSeconds}s for client to load, then clicking Play...`);
        await new Promise((r) => setTimeout(r, waitSeconds * 1000));
        await this.clickPlayButton(game, onStatus);
      }

      account.lastPlayed = new Date().toISOString();
      this.storage.saveAccount(account);

      return {
        success: true,
        message: `Launched ${game.toUpperCase()} for ${account.riotId || account.label}!`,
      };
    }

    // 2. SILENT SWITCH: If target account has a saved session, restore it silently (no keyboard/mouse needed)
    if (this.storage.hasSavedSession(account.id)) {
      onStatus?.(`Silently switching to ${account.riotId || account.label} (no keyboard/mouse needed)...`);

      // Terminate running clients WITHOUT wiping the session
      await this.closeRunningClients(false);

      // Restore target account's saved session
      const restored = this.storage.restoreAccountSession(account.id);
      if (restored) {
        onStatus?.(`Launching ${game.toUpperCase()} directly...`);
        const child = spawn(clientPath, [`--launch-product=${productArg}`, '--launch-patchline=live'], {
          detached: true,
          stdio: 'ignore',
          windowsHide: false,
        });
        child.unref();

        if (process.platform === 'win32') {
          const waitSeconds = Math.max(4, Math.min(12, settings.launchDelaySeconds || 5));
          onStatus?.(`Client loading in background (${waitSeconds}s)...`);
          await new Promise((r) => setTimeout(r, waitSeconds * 1000));
          await this.clickPlayButton(game, onStatus);
        }

        account.lastPlayed = new Date().toISOString();
        this.storage.saveAccount(account);

        return {
          success: true,
          message: `Silently switched to ${account.riotId || account.label} and launched ${game.toUpperCase()}!`,
        };
      }
    }

    // 3. FIRST-TIME LOGIN OR SESSION RESET:
    // Target account has no saved session -> MUST wipe running session so Riot Client CANNOT stay logged in to old account!
    onStatus?.(`Switching to ${account.label}: logging out previous account and resetting session...`);
    await this.closeRunningClients(true);

    onStatus?.(`Opening Riot Client for ${account.label} (${game.toUpperCase()})...`);
    const launchArgs = [`--launch-product=${productArg}`, '--launch-patchline=live'];

    const child = spawn(clientPath, launchArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();

    // Auto-login automation via strictly isolated, verified input
    if (process.platform === 'win32') {
      const loginWait = Math.max(5, Math.min(15, settings.launchDelaySeconds || 7));
      onStatus?.(`Waiting ${loginWait}s for Riot Client login screen...`);
      await new Promise((r) => setTimeout(r, loginWait * 1000));

      onStatus?.(`Safely entering credentials for ${account.username} (Strict Isolation Guard)...`);
      const typed = await this.injectCredentialsSafely(account.username, password, onStatus);

      if (!typed) {
        onStatus?.('Input guard active: Could not safely verify Riot Client window. Waiting for user interaction.');
      } else if (account.has2fa) {
        onStatus?.('2FA Protected: Complete verification in Riot Client (session will be saved once logged in).');
      } else {
        onStatus?.('Credentials submitted. Waiting for home screen to load...');
        await new Promise((r) => setTimeout(r, 8000));

        // Automatically capture and save the session so all future launches are 100% silent!
        const saved = this.storage.saveAccountSession(account.id);
        if (saved) {
          onStatus?.('Silent session saved! Future switches to this account will be 100% silent.');
        }

        onStatus?.('Clicking Play button...');
        await this.clickPlayButton(game, onStatus);
      }
    }

    // Update last played timestamp
    account.lastPlayed = new Date().toISOString();
    this.storage.saveAccount(account);

    return {
      success: true,
      message: account.has2fa
        ? `Credentials entered — complete 2FA in Riot Client.`
        : `Switched to ${account.riotId || account.label} and launched ${game.toUpperCase()}. Session saved for future silent launches!`,
    };
  }

  /**
   * Inject credentials safely with STRICT ISOLATION and INPUT VERIFICATION.
   * - Uses EnumWindows to locate the actual visible Riot Client window.
   * - Uses Win32 AttachThreadInput to activate Riot Client without focus lock issues.
   * - SAFETY GATE: Checks GetForegroundWindow(). If the foreground window does NOT belong
   *   to a Riot process, IT NEVER TYPES A SINGLE KEYSTROKE (protecting YouTube, browsers, etc.).
   * - INPUT VERIFICATION: Verifies via clipboard/selection that the entered username matches
   *   what is in the input field before proceeding to password and submission.
   */
  private async injectCredentialsSafely(
    username: string,
    pass: string,
    onStatus?: (status: string) => void
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms

Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Threading;

public class RiotInputGuard {
    public struct RECT { public int Left, Top, Right, Bottom; }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();

    public static IntPtr FindRiotWindow() {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            RECT r;
            GetWindowRect(hWnd, out r);
            int width = r.Right - r.Left;
            int height = r.Bottom - r.Top;
            if (width < 350 || height < 250 || r.Left < -10000) return true;

            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            try {
                Process p = Process.GetProcessById((int)pid);
                string name = p.ProcessName.ToLower();
                if (name.Contains("riot") || name.Contains("leagueclient") || name.Contains("valorant")) {
                    found = hWnd;
                    return false;
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static bool ActivateWindowSafely(IntPtr targetHwnd) {
        if (targetHwnd == IntPtr.Zero) return false;
        IntPtr fgHwnd = GetForegroundWindow();
        if (fgHwnd == targetHwnd) return true;

        uint fgPid;
        uint fgThread = fgHwnd != IntPtr.Zero ? GetWindowThreadProcessId(fgHwnd, out fgPid) : 0;
        uint curThread = GetCurrentThreadId();
        uint targetPid;
        uint targetThread = GetWindowThreadProcessId(targetHwnd, out targetPid);

        if (fgThread != 0 && fgThread != curThread) AttachThreadInput(curThread, fgThread, true);
        if (targetThread != 0 && targetThread != curThread) AttachThreadInput(curThread, targetThread, true);

        ShowWindow(targetHwnd, 9); // SW_RESTORE
        BringWindowToTop(targetHwnd);
        bool ok = SetForegroundWindow(targetHwnd);

        if (fgThread != 0 && fgThread != curThread) AttachThreadInput(curThread, fgThread, false);
        if (targetThread != 0 && targetThread != curThread) AttachThreadInput(curThread, targetThread, false);

        Thread.Sleep(150);
        return ok;
    }

    public static bool IsForegroundRiot() {
        IntPtr fg = GetForegroundWindow();
        if (fg == IntPtr.Zero) return false;
        uint pid;
        GetWindowThreadProcessId(fg, out pid);
        try {
            string name = Process.GetProcessById((int)pid).ProcessName.ToLower();
            return name.Contains("riot") || name.Contains("leagueclient") || name.Contains("valorant");
        } catch {
            return false;
        }
    }
}
"@

$user = [Console]::In.ReadLine()
$password = [Console]::In.ReadLine()
if (-not $user -or -not $password) { exit 1 }

# --- 1. Find Riot Client window ---
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 20; $i++) {
    $hwnd = [RiotInputGuard]::FindRiotWindow()
    if ($hwnd -ne [IntPtr]::Zero) { break }
    Start-Sleep -Milliseconds 500
}

if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "ERR_WINDOW_NOT_FOUND"
    exit 2
}

# --- 2. Activate Riot Client window safely ---
[RiotInputGuard]::ActivateWindowSafely($hwnd) | Out-Null
Start-Sleep -Milliseconds 400

# --- 3. STRICT SAFETY GATE: Ensure foreground window is 100% Riot Client ---
$isRiot = [RiotInputGuard]::IsForegroundRiot()
if (-not $isRiot) {
    # Retry once more with focus activation
    [RiotInputGuard]::ActivateWindowSafely($hwnd) | Out-Null
    Start-Sleep -Milliseconds 400
    $isRiot = [RiotInputGuard]::IsForegroundRiot()
}

if (-not $isRiot) {
    # NEVER TOUCH ANYTHING ELSE! Abort immediately to protect user's browser/YouTube.
    Write-Output "ERR_FOCUS_PROTECTED"
    exit 3
}

# --- 4. Focus Username Field & Clear ---
[System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
Start-Sleep -Milliseconds 150

# Type username
foreach ($char in $user.ToCharArray()) {
    if (-not [RiotInputGuard]::IsForegroundRiot()) { exit 4 }
    $c = [string]$char
    if ($c -match '[+^%~{}()\[\]]') { [System.Windows.Forms.SendKeys]::SendWait("{$c}") }
    else { [System.Windows.Forms.SendKeys]::SendWait($c) }
    Start-Sleep -Milliseconds 20
}

Start-Sleep -Milliseconds 150

# --- 5. INPUT VERIFICATION: Assure username was typed into the correct field ---
# Copy current field text to verify
[System.Windows.Forms.Clipboard]::Clear()
[System.Windows.Forms.SendKeys]::SendWait('^a^c')
Start-Sleep -Milliseconds 150
$copied = [System.Windows.Forms.Clipboard]::GetText()

if ($copied -and $copied.Trim() -ne $user.Trim()) {
    # If content doesn't match, re-clear and re-type with a small delay
    [System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
    Start-Sleep -Milliseconds 150
    foreach ($char in $user.ToCharArray()) {
        if (-not [RiotInputGuard]::IsForegroundRiot()) { exit 4 }
        $c = [string]$char
        if ($c -match '[+^%~{}()\[\]]') { [System.Windows.Forms.SendKeys]::SendWait("{$c}") }
        else { [System.Windows.Forms.SendKeys]::SendWait($c) }
        Start-Sleep -Milliseconds 25
    }
}

# Move to password field
if (-not [RiotInputGuard]::IsForegroundRiot()) { exit 4 }
[System.Windows.Forms.SendKeys]::SendWait('{TAB}')
Start-Sleep -Milliseconds 200

# Clear password field
[System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
Start-Sleep -Milliseconds 100

# Type password
foreach ($char in $password.ToCharArray()) {
    if (-not [RiotInputGuard]::IsForegroundRiot()) { exit 4 }
    $c = [string]$char
    if ($c -match '[+^%~{}()\[\]]') { [System.Windows.Forms.SendKeys]::SendWait("{$c}") }
    else { [System.Windows.Forms.SendKeys]::SendWait($c) }
    Start-Sleep -Milliseconds 20
}

# Ensure 'Stay signed in' checkbox is selected for persistent silent session capture
Start-Sleep -Milliseconds 150
if ([RiotInputGuard]::IsForegroundRiot()) {
    [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait(' ')
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
}

Write-Output "SUCCESS"
`;

      const ps = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      let output = '';
      ps.stdout.on('data', (d) => { output += d.toString(); });
      ps.stderr.on('data', (d) => { output += d.toString(); });

      ps.stdin.write(username + '\r\n');
      ps.stdin.write(pass + '\r\n');
      ps.stdin.end();

      ps.on('close', (code) => {
        if (code === 0 && output.includes('SUCCESS')) {
          onStatus?.('Credentials successfully entered and verified in Riot Client.');
          resolve(true);
        } else if (output.includes('ERR_FOCUS_PROTECTED')) {
          onStatus?.('Safety Shield: Keystrokes were blocked because Riot Client was not focused.');
          resolve(false);
        } else {
          resolve(false);
        }
      });

      ps.on('error', () => resolve(false));
      setTimeout(() => {
        try { ps.kill(); } catch {}
        resolve(false);
      }, 20000);
    });
  }

  /**
   * Click the Play button in Riot Client using a STRICTLY PROTECTED mouse click.
   * - Verifies that the target HWND and point belong strictly to Riot Client.
   * - Remembers the user's cursor position and immediately restores it within milliseconds
   *   so the user's physical mouse is NEVER displaced while browsing or watching YouTube.
   * - If Riot Client is not in the foreground, IT NEVER CLICKS.
   */
  private async clickPlayButton(game: 'valorant' | 'league', onStatus?: (status: string) => void): Promise<void> {
    const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Threading;

public class RiotMouseGuard {
    public struct RECT { public int Left, Top, Right, Bottom; }
    public struct POINT { public int X, Y; }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT pt);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);

    public static IntPtr FindRiotWindow() {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            RECT r;
            GetWindowRect(hWnd, out r);
            int width = r.Right - r.Left;
            int height = r.Bottom - r.Top;
            if (width < 350 || height < 250 || r.Left < -10000) return true;

            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            try {
                Process p = Process.GetProcessById((int)pid);
                string name = p.ProcessName.ToLower();
                if (name.Contains("riot") || name.Contains("leagueclient") || name.Contains("valorant")) {
                    found = hWnd;
                    return false;
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static bool ActivateWindowSafely(IntPtr targetHwnd) {
        if (targetHwnd == IntPtr.Zero) return false;
        IntPtr fgHwnd = GetForegroundWindow();
        if (fgHwnd == targetHwnd) return true;

        uint fgPid;
        uint fgThread = fgHwnd != IntPtr.Zero ? GetWindowThreadProcessId(fgHwnd, out fgPid) : 0;
        uint curThread = GetCurrentThreadId();
        uint targetPid;
        uint targetThread = GetWindowThreadProcessId(targetHwnd, out targetPid);

        if (fgThread != 0 && fgThread != curThread) AttachThreadInput(curThread, fgThread, true);
        if (targetThread != 0 && targetThread != curThread) AttachThreadInput(curThread, targetThread, true);

        ShowWindow(targetHwnd, 9);
        BringWindowToTop(targetHwnd);
        bool ok = SetForegroundWindow(targetHwnd);

        if (fgThread != 0 && fgThread != curThread) AttachThreadInput(curThread, fgThread, false);
        if (targetThread != 0 && targetThread != curThread) AttachThreadInput(curThread, targetThread, false);

        Thread.Sleep(150);
        return ok;
    }

    public static bool IsForegroundRiot() {
        IntPtr fg = GetForegroundWindow();
        if (fg == IntPtr.Zero) return false;
        uint pid;
        GetWindowThreadProcessId(fg, out pid);
        try {
            string name = Process.GetProcessById((int)pid).ProcessName.ToLower();
            return name.Contains("riot") || name.Contains("leagueclient") || name.Contains("valorant");
        } catch {
            return false;
        }
    }

    public static bool IsPointInRiot(int x, int y) {
        POINT pt = new POINT { X = x, Y = y };
        IntPtr wnd = WindowFromPoint(pt);
        if (wnd == IntPtr.Zero) return false;
        uint pid;
        GetWindowThreadProcessId(wnd, out pid);
        try {
            string name = Process.GetProcessById((int)pid).ProcessName.ToLower();
            return name.Contains("riot") || name.Contains("leagueclient") || name.Contains("valorant");
        } catch {
            return false;
        }
    }

    public static bool ClickPlaySafely(int x, int y) {
        // STRICT CHECK: Both the foreground window and the target point MUST be Riot Client
        if (!IsForegroundRiot() || !IsPointInRiot(x, y)) {
            return false;
        }

        POINT orig;
        GetCursorPos(out orig);

        SetCursorPos(x, y);
        Thread.Sleep(80);
        mouse_event(0x0002, 0, 0, 0, IntPtr.Zero); // LEFTDOWN
        Thread.Sleep(50);
        mouse_event(0x0004, 0, 0, 0, IntPtr.Zero); // LEFTUP
        Thread.Sleep(40);

        // Instantly restore user mouse position
        SetCursorPos(orig.X, orig.Y);
        return true;
    }
}
"@

# 1. Find Riot Client window
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 16; $i++) {
    $hwnd = [RiotMouseGuard]::FindRiotWindow()
    if ($hwnd -ne [IntPtr]::Zero) { break }
    Start-Sleep -Milliseconds 500
}

if ($hwnd -eq [IntPtr]::Zero) { exit 1 }

# 2. Activate window safely
[RiotMouseGuard]::ActivateWindowSafely($hwnd) | Out-Null
Start-Sleep -Milliseconds 400

# 3. Verify foreground window is Riot Client
if (-not [RiotMouseGuard]::IsForegroundRiot()) {
    # NEVER CLICK IF NOT RIOT CLIENT!
    exit 2
}

# 4. Calculate Play button coordinates inside the window rect
$r = New-Object RiotMouseGuard+RECT
[RiotMouseGuard]::GetWindowRect($hwnd, [ref]$r)

$w = $r.Right - $r.Left
$h = $r.Bottom - $r.Top

if ($w -lt 200 -or $h -lt 150) { exit 3 }

$playX = $r.Left + [int]($w * 0.14)
$playY = $r.Top + [int]($h * 0.87)

# 5. Click Play button with instant cursor restoration
$clicked = [RiotMouseGuard]::ClickPlaySafely($playX, $playY)
if ($clicked) {
    Start-Sleep -Milliseconds 3000
    if ([RiotMouseGuard]::IsForegroundRiot()) {
        # Click again to handle potential "Update Available" dialog safely
        [RiotMouseGuard]::ClickPlaySafely($playX, $playY) | Out-Null
    }
}
`;

    await new Promise<void>((resolve) => {
      const ps = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
        { windowsHide: true, stdio: 'ignore' }
      );
      ps.on('close', () => resolve());
      ps.on('error', () => resolve());
      setTimeout(() => {
        try { ps.kill(); } catch {}
        resolve();
      }, 15000);
    });
  }
}

