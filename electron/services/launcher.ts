import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { StorageService } from './storage';
import { RiotApiService } from './riotApi';
import { RiotAccount } from '../types';

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

    const settings = this.storage.getSettings();
    // Only terminate running processes if autoCloseClients is enabled, or if wiping session is strictly required
    if (!settings.autoCloseClients && !wipeSession) {
      return;
    }

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

    // 1. Snapshot the currently active Riot session on disk or via API before switching
    let isAlreadyActive = false;
    try {
      // Check active account on disk first (works even if Riot Client was closed or chat socket is inactive)
      const diskActive = this.storage.getActiveSessionAccount();
      if (diskActive && diskActive.id) {
        this.storage.saveAccountSession(diskActive.id);
        if (diskActive.id === account.id) {
          isAlreadyActive = true;
        }
      }

      const active = await this.riotApi.detectActiveSession();
      if (active) {
        // Match active account from API
        const activeAccount = accounts.find((a) =>
          (a.username && active.username && a.username.toLowerCase() === active.username.toLowerCase()) ||
          (a.riotId && active.riotId && a.riotId.toLowerCase() === active.riotId.toLowerCase())
        );
        if (activeAccount) {
          this.storage.saveAccountSession(activeAccount.id);
          if (activeAccount.id === account.id) {
            isAlreadyActive = true;
          }
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
        if (settings.autoLaunchGame) {
          onStatus?.(`Waiting ${waitSeconds}s for client to load, then clicking Play...`);
          await new Promise((r) => setTimeout(r, waitSeconds * 1000));
          await this.clickPlayButton(game, onStatus);
        } else {
          onStatus?.('Ready in Riot Client! (Auto-launch game is disabled in Settings)');
        }
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

      // Restore target account's saved session (injects 30-day 2FA trusted device if missing)
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
          if (settings.autoLaunchGame) {
            onStatus?.(`Client loading in background (${waitSeconds}s)...`);
            await new Promise((r) => setTimeout(r, waitSeconds * 1000));
            await this.clickPlayButton(game, onStatus);
          } else {
            onStatus?.('Silently logged in! (Auto-launch game is disabled in Settings)');
          }
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
    // Target account has no saved session -> reset session to force clean login screen (30-day 2FA trust preserved!)
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

    // Auto-login automation via smart login page detection and verified input
    if (process.platform === 'win32') {
      onStatus?.('Detecting Riot Client login screen (smart page detection)...');
      const screenReady = await this.riotApi.waitForLoginScreen(45000, onStatus);

      if (!screenReady) {
        onStatus?.('Login screen detection note: Continuing with direct window verification...');
      }

      // Respect user-configured delay setting for visual DOM mounting
      const stabilizationSeconds = Math.max(2, Math.min(10, settings.launchDelaySeconds || 4));
      onStatus?.(`Waiting ${stabilizationSeconds}s for Riot Client visual window to mount...`);
      await new Promise((r) => setTimeout(r, stabilizationSeconds * 1000));

      onStatus?.(`Safely entering credentials for ${account.username} (Strict Isolation Guard)...`);
      const typed = await this.injectCredentialsSafely(account.username, password, onStatus);

      if (!typed) {
        onStatus?.('Input guard: Could not verify credential entry in Riot Client.');
        return {
          success: false,
          message: `Riot Client opened, but could not automatically verify credentials for ${account.username}. Please ensure the login screen is visible, or use the "Auto-Type Credentials" option to retry.`,
        };
      }

      onStatus?.(
        account.has2fa
          ? 'Credentials entered. Please enter 2FA verification in Riot Client and keep "Remember this device" checked...'
          : 'Credentials submitted. Waiting for authentication...'
      );

      const maxWait = account.has2fa ? 90 : 40;
      const loggedIn = await this.waitForLoginAndSaveSession(account, maxWait, onStatus);

      if (loggedIn) {
        onStatus?.('Authentication verified and 30-day session saved! Future switches will be 100% silent.');
        if (settings.autoLaunchGame) {
          onStatus?.('Clicking Play button...');
          await this.clickPlayButton(game, onStatus);
        } else {
          onStatus?.('Authentication complete! (Auto-launch game is disabled in Settings)');
        }
      } else {
        onStatus?.('Riot Client opened. When login finishes, your session will automatically be saved in the background.');
      }
    }

    // Update last played timestamp
    account.lastPlayed = new Date().toISOString();
    this.storage.saveAccount(account);

    return {
      success: true,
      message: account.has2fa
        ? `Credentials entered — complete 2FA in Riot Client. 30-day device trust is preserved!`
        : `Switched to ${account.riotId || account.label} and launched ${game.toUpperCase()}. Session saved for future silent launches!`,
    };
  }

  /**
   * Actively polls disk and live API for login completion.
   * Once authenticated, captures and persists the session and backs up 30-day 2FA trusted device.
   */
  public async waitForLoginAndSaveSession(
    account: RiotAccount,
    timeoutSeconds: number = 40,
    onStatus?: (status: string) => void
  ): Promise<boolean> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      // 1. Check disk YAML for active authenticated session (fastest & most reliable)
      const diskAccount = this.storage.getActiveSessionAccount();
      if (diskAccount) {
        const matchUser = diskAccount.username && account.username &&
          diskAccount.username.toLowerCase() === account.username.toLowerCase();
        const matchRiotId = diskAccount.riotId && account.riotId &&
          diskAccount.riotId.toLowerCase() === account.riotId.toLowerCase();

        if (matchUser || matchRiotId || diskAccount.id === account.id) {
          this.storage.saveAccountSession(account.id);
          this.storage.backupTrustedDevice();
          account.hasSavedSession = true;
          if (diskAccount.tagline && (!account.tagline || account.tagline === 'EUNE' || account.tagline === 'EUW')) {
            account.tagline = diskAccount.tagline;
          }
          if (diskAccount.riotId) {
            account.riotId = diskAccount.riotId;
          }
          if (diskAccount.has2fa) {
            account.has2fa = true;
          }
          this.storage.saveAccount(account);
          return true;
        }
      }

      // 2. Check live Riot Client API via lockfile
      try {
        const live = await this.riotApi.detectActiveSession();
        if (live) {
          const matchLiveUser = live.username && account.username &&
            live.username.toLowerCase() === account.username.toLowerCase();
          const matchLiveId = live.riotId && account.riotId &&
            live.riotId.toLowerCase() === account.riotId.toLowerCase();

          if (matchLiveUser || matchLiveId) {
            this.storage.saveAccountSession(account.id);
            this.storage.backupTrustedDevice();
            account.hasSavedSession = true;
            this.storage.saveAccount(account);
            return true;
          }
        }
      } catch {}

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (account.has2fa) {
        onStatus?.(`Waiting for 2FA verification in Riot Client (${elapsed}s / ${timeoutSeconds}s)...`);
      } else {
        onStatus?.(`Waiting for Riot Client to log in (${elapsed}s)...`);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    return false;
  }

  /**
   * Standalone helper to type credentials into an already-open Riot Client login screen.
   * Useful when Riot Client was already open or if the initial auto-type timed out.
   */
  public async typeCredentialsDirectly(accountId: string): Promise<{ success: boolean; message: string }> {
    const accounts = this.storage.getAccounts();
    const account = accounts.find((a) => a.id === accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const password = this.storage.getAccountPassword(account.username);
    if (!password) {
      throw new Error(`No credentials saved for ${account.username}. Please edit the account and re-enter the password.`);
    }

    const typed = await this.injectCredentialsSafely(account.username, password);
    if (typed) {
      // Monitor in background to capture the session once login completes
      this.waitForLoginAndSaveSession(account, 60).catch(() => {});
      return {
        success: true,
        message: `Credentials for ${account.username} entered and verified in Riot Client!`,
      };
    } else {
      return {
        success: false,
        message: `Could not focus or enter credentials in Riot Client. Please ensure Riot Client is open at the login screen and not minimized.`,
      };
    }
  }

  /**
   * Inject credentials safely with STRICT ISOLATION and MULTI-ATTEMPT INPUT VERIFICATION.
   * - Uses EnumWindows to locate the top-level visible interactive Riot Client window (RiotClientUx).
   * - Bypasses Windows foreground lock policies via simulated ALT key + AttachThreadInput + SW_RESTORE.
   * - Adaptive dual-focus strategy: checks candidate coordinates + keyboard TAB navigation.
   * - Verifies entered username via clipboard selection (^a^c) before touching password or Enter.
   * - Fallback character-by-character typing if clipboard paste is rejected by host.
   * - Replaces false-positive exits with strict verification checking.
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
using System.Collections.Generic;

public class RiotInputGuard {
    public struct RECT { public int Left, Top, Right, Bottom; }
    public struct POINT { public int X, Y; }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);

    private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_SHOWWINDOW = 0x0040;
    private const byte VK_MENU = 0x12;
    private const uint KEYEVENTF_KEYUP = 0x0002;

    public class WindowCandidate {
        public IntPtr Hwnd;
        public int Score;
        public int Width;
        public int Height;
    }

    public static IntPtr FindRiotWindow() {
        var candidates = new List<WindowCandidate>();
        uint curPid = (uint)Process.GetCurrentProcess().Id;

        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) return true;
            RECT r;
            GetWindowRect(hWnd, out r);
            int width = r.Right - r.Left;
            int height = r.Bottom - r.Top;
            if (width < 350 || height < 250 || r.Left < -10000) return true;

            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid == curPid) return true;

            try {
                Process p = Process.GetProcessById((int)pid);
                string name = p.ProcessName.ToLower();

                if (name.Contains("switcher") || name.Contains("manager") || name.Contains("electron")) {
                    return true;
                }

                var sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString().ToLower();

                var cb = new StringBuilder(256);
                GetClassName(hWnd, cb, 256);
                string cls = cb.ToString();

                bool isRiotProc = name == "riot client" || name == "riotclientservices" || name == "riotclientux" || name.StartsWith("riotclient");
                bool isRiotTitle = title.Contains("riot client");
                bool isChromiumClass = cls.StartsWith("Chrome_WidgetWin") || cls.ToLower().Contains("riot") || string.IsNullOrEmpty(cls);

                if ((isRiotProc || isRiotTitle) && isChromiumClass) {
                    int score = 10;
                    if (name.Contains("ux")) score += 30;
                    if (isRiotTitle) score += 40;
                    if (cls == "Chrome_WidgetWin_1") score += 25;
                    score += Math.Min((width * height) / 50000, 30);

                    candidates.Add(new WindowCandidate {
                        Hwnd = hWnd,
                        Score = score,
                        Width = width,
                        Height = height
                    });
                }
            } catch {}
            return true;
        }, IntPtr.Zero);

        if (candidates.Count == 0) return IntPtr.Zero;
        candidates.Sort((a, b) => b.Score.CompareTo(a.Score));
        return candidates[0].Hwnd;
    }

    public static bool ActivateWindowSafely(IntPtr targetHwnd) {
        if (targetHwnd == IntPtr.Zero) return false;

        // Bypass Windows foreground lock using simulated ALT key
        keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        IntPtr fgHwnd = GetForegroundWindow();
        uint fgPid;
        uint fgThread = fgHwnd != IntPtr.Zero ? GetWindowThreadProcessId(fgHwnd, out fgPid) : 0;
        uint curThread = GetCurrentThreadId();
        uint targetPid;
        uint targetThread = GetWindowThreadProcessId(targetHwnd, out targetPid);

        if (fgThread != 0 && fgThread != curThread) AttachThreadInput(curThread, fgThread, true);
        if (targetThread != 0 && targetThread != curThread) AttachThreadInput(curThread, targetThread, true);

        if (IsIconic(targetHwnd)) {
            ShowWindow(targetHwnd, 9); // SW_RESTORE
        } else {
            ShowWindow(targetHwnd, 5); // SW_SHOW
        }

        SetWindowPos(targetHwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
        SetWindowPos(targetHwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);

        BringWindowToTop(targetHwnd);
        bool ok = SetForegroundWindow(targetHwnd);

        if (fgThread != 0 && fgThread != curThread) AttachThreadInput(curThread, fgThread, false);
        if (targetThread != 0 && targetThread != curThread) AttachThreadInput(curThread, targetThread, false);

        Thread.Sleep(200);
        return ok;
    }

    public static bool IsForegroundRiot() {
        IntPtr fg = GetForegroundWindow();
        if (fg == IntPtr.Zero) return false;
        uint pid;
        GetWindowThreadProcessId(fg, out pid);
        try {
            string name = Process.GetProcessById((int)pid).ProcessName.ToLower();
            if (name.Contains("switcher") || name.Contains("manager") || name.Contains("electron")) return false;
            if (name == "riot client" || name.StartsWith("riotclient")) return true;
            var sb = new StringBuilder(256);
            GetWindowText(fg, sb, 256);
            return sb.ToString().ToLower().Contains("riot client");
        } catch {
            return false;
        }
    }

    public static void ClickAt(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(40);
        mouse_event(0x0002, 0, 0, 0, IntPtr.Zero); // LEFTDOWN
        Thread.Sleep(60);
        mouse_event(0x0004, 0, 0, 0, IntPtr.Zero); // LEFTUP
        Thread.Sleep(60);
    }
}
"@

$userB64 = [Console]::In.ReadLine()
$passB64 = [Console]::In.ReadLine()
if (-not $userB64 -or -not $passB64) { exit 1 }

$user = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($userB64))
$password = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($passB64))

# Enable Per-Monitor DPI awareness
[RiotInputGuard]::SetProcessDPIAware() | Out-Null

function Set-ClipboardSafe($text) {
    for ($i = 0; $i -lt 8; $i++) {
        try {
            [System.Windows.Forms.Clipboard]::SetText($text)
            return $true
        } catch {
            Start-Sleep -Milliseconds 30
        }
    }
    return $false
}

function Get-ClipboardSafe() {
    for ($i = 0; $i -lt 8; $i++) {
        try {
            if ([System.Windows.Forms.Clipboard]::ContainsText()) {
                return [System.Windows.Forms.Clipboard]::GetText()
            }
            return ""
        } catch {
            Start-Sleep -Milliseconds 30
        }
    }
    return ""
}

# Preserve user's original cursor position
$origPt = New-Object RiotInputGuard+POINT
[RiotInputGuard]::GetCursorPos([ref]$origPt) | Out-Null
$origX = $origPt.X
$origY = $origPt.Y

# Backup existing clipboard text so user's clipboard is preserved
$prevClipboard = $null
try {
    if ([System.Windows.Forms.Clipboard]::ContainsText()) {
        $prevClipboard = [System.Windows.Forms.Clipboard]::GetText()
    }
} catch {}

# --- 1. Find Riot Client window ---
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 30; $i++) {
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
Start-Sleep -Milliseconds 300

# --- 3. STRICT SAFETY GATE: Ensure foreground window is Riot Client ---
$isRiot = [RiotInputGuard]::IsForegroundRiot()
if (-not $isRiot) {
    [RiotInputGuard]::ActivateWindowSafely($hwnd) | Out-Null
    Start-Sleep -Milliseconds 400
    $isRiot = [RiotInputGuard]::IsForegroundRiot()
}

if (-not $isRiot) {
    Write-Output "ERR_FOCUS_PROTECTED"
    exit 3
}

$r = New-Object RiotInputGuard+RECT
[RiotInputGuard]::GetWindowRect($hwnd, [ref]$r) | Out-Null
$w = $r.Right - $r.Left
$h = $r.Bottom - $r.Top

# The login sidebar is docked on the left (typical width ~400px)
$baseX = $r.Left + [Math]::Min(205, [int]($w * 0.22))
if ($baseX -lt ($r.Left + 150)) { $baseX = $r.Left + 200 }

# Adaptive candidate Y offsets for username input field
$userYOffsets = @(245, 265, 230, 285)
$verified = $false

# --- 4. Multi-Attempt Adaptive Username Input & Strict Verification ---
for ($attempt = 0; $attempt -lt 4; $attempt++) {
    if (-not [RiotInputGuard]::IsForegroundRiot()) {
        [RiotInputGuard]::ActivateWindowSafely($hwnd) | Out-Null
        Start-Sleep -Milliseconds 250
    }
    if (-not [RiotInputGuard]::IsForegroundRiot()) {
        Start-Sleep -Milliseconds 300
        continue
    }

    $yOffset = $userYOffsets[$attempt % $userYOffsets.Length]
    [RiotInputGuard]::ClickAt($baseX, $r.Top + $yOffset)

    # On attempt >= 2, send TAB to cycle focus directly into username if click landed nearby
    if ($attempt -ge 2) {
        [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
        Start-Sleep -Milliseconds 60
    }

    # Clear field
    [System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
    Start-Sleep -Milliseconds 60

    # Paste username via clipboard
    Set-ClipboardSafe $user | Out-Null
    Start-Sleep -Milliseconds 60
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 120

    # VERIFY USERNAME IN FIELD
    [System.Windows.Forms.SendKeys]::SendWait('^a^c')
    Start-Sleep -Milliseconds 120
    $copied = Get-ClipboardSafe

    if ($copied -and $copied.Trim() -eq $user.Trim()) {
        $verified = $true
        break
    }

    # Fallback: try character SendKeys typing if paste didn't register
    if ($attempt -eq 1 -or $attempt -eq 3) {
        [System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
        Start-Sleep -Milliseconds 40
        $escapedUser = $user -replace '([+^%~(){}])', '{$1}'
        [System.Windows.Forms.SendKeys]::SendWait($escapedUser)
        Start-Sleep -Milliseconds 100
        [System.Windows.Forms.SendKeys]::SendWait('^a^c')
        Start-Sleep -Milliseconds 100
        $copied2 = Get-ClipboardSafe
        if ($copied2 -and $copied2.Trim() -eq $user.Trim()) {
            $verified = $true
            break
        }
    }

    Start-Sleep -Milliseconds 350
}

# Strict Failure Detection: If username could not be verified in field, abort!
if (-not $verified) {
    if ($prevClipboard) { Set-ClipboardSafe $prevClipboard | Out-Null }
    if ($origX -ge 0 -and $origY -ge 0) { [RiotInputGuard]::SetCursorPos($origX, $origY) }
    Write-Output "ERR_INPUT_NOT_VERIFIED"
    exit 4
}

# --- 5. Focus Password Field & Input via TAB and Click ---
if (-not [RiotInputGuard]::IsForegroundRiot()) {
    [RiotInputGuard]::ActivateWindowSafely($hwnd) | Out-Null
    Start-Sleep -Milliseconds 200
}

# In Riot Client web form, pressing TAB from the verified username field focuses password
[System.Windows.Forms.SendKeys]::SendWait('{TAB}')
Start-Sleep -Milliseconds 80

# Also click password field coordinate for redundancy
[RiotInputGuard]::ClickAt($baseX, $r.Top + 315)
Start-Sleep -Milliseconds 80

[System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}')
Start-Sleep -Milliseconds 60

Set-ClipboardSafe $password | Out-Null
Start-Sleep -Milliseconds 60
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 120

# Clean password from clipboard immediately
try { [System.Windows.Forms.Clipboard]::Clear() } catch {}

# --- 6. Direct Form Submission ---
if ([RiotInputGuard]::IsForegroundRiot()) {
    Start-Sleep -Milliseconds 80
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
}

# Restore user's previous clipboard
if ($prevClipboard) {
    Set-ClipboardSafe $prevClipboard | Out-Null
}

# Restore mouse cursor back to original position
if ($origX -ge 0 -and $origY -ge 0) {
    [RiotInputGuard]::SetCursorPos($origX, $origY)
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

      const userB64 = Buffer.from(username, 'utf-8').toString('base64');
      const passB64 = Buffer.from(pass, 'utf-8').toString('base64');

      ps.stdin.write(userB64 + '\r\n');
      ps.stdin.write(passB64 + '\r\n');
      ps.stdin.end();

      ps.on('close', (code) => {
        if (code === 0 && output.includes('SUCCESS')) {
          onStatus?.('Credentials successfully entered and verified in Riot Client.');
          resolve(true);
        } else if (output.includes('ERR_FOCUS_PROTECTED')) {
          onStatus?.('Safety Shield: Keystrokes were blocked because Riot Client was not focused.');
          resolve(false);
        } else if (output.includes('ERR_INPUT_NOT_VERIFIED')) {
          onStatus?.('Input guard: Username field could not be focused or verified after multiple attempts.');
          resolve(false);
        } else {
          onStatus?.('Input guard: Automated credential entry did not complete.');
          resolve(false);
        }
      });

      ps.on('error', () => resolve(false));
      setTimeout(() => {
        try { ps.kill(); } catch {}
        resolve(false);
      }, 35000);
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

    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
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
        uint curPid = (uint)Process.GetCurrentProcess().Id;
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            RECT r;
            GetWindowRect(hWnd, out r);
            int width = r.Right - r.Left;
            int height = r.Bottom - r.Top;
            if (width < 350 || height < 250 || r.Left < -10000) return true;

            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid == curPid) return true;

            try {
                Process p = Process.GetProcessById((int)pid);
                string name = p.ProcessName.ToLower();

                // Explicitly ignore our own switcher, manager, or electron wrapper
                if (name.Contains("switcher") || name.Contains("manager") || name.Contains("electron")) {
                    return true;
                }

                var sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString().ToLower();

                var cb = new StringBuilder(256);
                GetClassName(hWnd, cb, 256);
                string cls = cb.ToString();

                bool isRiotProc = name == "riot client" || name == "riotclientservices" || name.StartsWith("riotclient");
                bool isRiotTitle = title.Contains("riot client");
                bool isChromiumOrRiotClass = cls.StartsWith("Chrome_WidgetWin") || cls.ToLower().Contains("riot") || string.IsNullOrEmpty(cls);

                if ((isRiotProc || isRiotTitle) && isChromiumOrRiotClass) {
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
            if (name.Contains("switcher") || name.Contains("manager") || name.Contains("electron")) return false;
            if (name == "riot client" || name.StartsWith("riotclient")) return true;
            var sb = new StringBuilder(256);
            GetWindowText(fg, sb, 256);
            return sb.ToString().ToLower().Contains("riot client");
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
            if (name.Contains("switcher") || name.Contains("manager") || name.Contains("electron")) return false;
            return name == "riot client" || name.StartsWith("riotclient");
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

# Enable Per-Monitor True DPI Awareness so coordinates align with physical pixels
[RiotMouseGuard]::SetProcessDPIAware() | Out-Null

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

