# 🎮 Riot Account Switcher

A high-performance, secure desktop application wrapper for managing multiple Riot Games accounts across **VALORANT** and **League of Legends**. Switch accounts with a single click, automatically sync real-time in-game statistics directly from the Riot Client, and monitor regional server latencies.

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6.svg)](https://microsoft.com/windows)
[![Framework](https://img.shields.io/badge/Built%20With-Electron%20%7C%20React%2019%20%7C%20TypeScript-00F5D4.svg)](#)

---

## ✨ Features

### ⚡ 1-Click Instant Account Switching
- Switch between multiple Riot accounts without manually logging out and re-entering credentials.
- Auto-launches **VALORANT** or **League of Legends** with the selected profile.
- Secure standard input (`stdin`) automation avoids exposing credentials in Windows command-line arguments or Task Manager.

### 🛡️ Two-Factor Authentication (2FA / MFA) Support
- Visual `2FA Active` badge on account cards in the switcher window.
- Dedicated 2FA status prompt reminds you to approve the email or mobile authenticator code upon switching.

### 📊 Real-Time Riot In-Game Stats Sync (Zero API Keys Needed!)
- Direct local integration with active Riot Client sessions (`%LOCALAPPDATA%\Riot Games\Riot Client\Config\lockfile`).
- **VALORANT Data**:
  - **Account Level** (real progression from Riot's XP endpoint).
  - **Rank & Rank Rating** (RR) with accurate unranked detection for accounts under Level 20.
  - **Live Balances**: Valorant Points (VP), Radianite Points (RAD), and Kingdom Credits (KC).
  - **Collection Overview**: Weapon skins count & agents unlocked.
  - **Match History**: Maps, scores, agents, KDA, and headshot percentages.
- **League of Legends Data**:
  - **Summoner Level** & Solo/Duo rank + LP + winrate (W/L).
  - **Live Balances**: Riot Points (RP) & Blue Essence (BE).
  - **Collection Overview**: Total Champions owned & Skins owned.
  - **Top Champion Masteries**: Levels, points, and recent match breakdowns.

### ⚡ Auto-Detect Riot ID & Tagline
- With Riot Client open, click **Auto-Detect from Riot Client** to instantly populate your Riot ID name, tagline (`#TAG`), and server region without manual typing.

### 🔐 Bank-Grade Hardware Encryption
- **Windows DPAPI**: Account passwords encrypted at rest via Electron's `safeStorage` (bound to your Windows user account and TPM hardware).
- **AES-256-GCM Portable Backup**: Encrypted JSON vault export/import protected by PBKDF2 (100,000 iterations) and an optional master passphrase.
- **Isolated Renderer**: `contextIsolation: true`, `sandbox: true`, and strict navigation restrictions.

### 🌐 Regional Ping Monitor
- Live round-trip TCP/HTTP latency measurement across 9 Riot cluster regions:
  - **North America (NA)** — Chicago
  - **Europe West (EUW)** — Frankfurt
  - **Europe Nordic & East (EUNE)** — Frankfurt
  - **Korea (KR)** — Seoul
  - **Asia Pacific (AP)** — Singapore
  - **Brazil (BR)** — São Paulo
  - **Latin America North (LAN)** — Mexico City
  - **Latin America South (LAS)** — Santiago
  - **Oceania (OCE)** — Sydney

### 📌 System Tray Integration
- Minimizes cleanly to the Windows taskbar notification tray.
- Right-click tray menu for instant 1-click game launching per account without opening the dashboard.

---

## 🚀 Getting Started

### Option 1: Standalone 1-Click Executable (No Setup Required)
1. Download or run **`Riot Account Switcher.exe`** from the repository root.
2. The app opens immediately with no prerequisites or installer needed.

### Option 2: Run / Build from Source
Ensure you have **Node.js** (v18+ recommended) installed.

```bash
# 1. Clone the repository
git clone https://github.com/24Quary24/Riot-Account-Switcher.git
cd Riot-Account-Switcher

# 2. Install dependencies
npm install

# 3. Start in development mode
npm run dev

# 4. Build standalone Windows executable
npm run build
npx electron-builder --win portable
```

---

## 🔒 Security Architecture

| Vector | Protection Mechanism |
|---|---|
| **Passwords at Rest** | Encrypted via Windows DPAPI hardware-backed encryption (`safeStorage`). |
| **Password Injection** | Piped directly through PowerShell's **standard input stream (`stdin`)**; credentials **never** appear in command-line arguments or task manager process inspection. |
| **Keystroke Security** | All SendKeys modifier characters (`+`, `^`, `%`, `~`, `{}`, `[]`) are individually bracketed and sanitized. |
| **File Permissions** | Vault files written with strict owner-only permissions (`mode: 0o600`). |
| **Process Security** | Electron renderer sandboxed (`sandbox: true`, `nodeIntegration: false`, `contextIsolation: true`). External links open strictly in default browser. |

---

## 📜 License
Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.

---

*Disclaimer: Riot Account Switcher is an independent community project and is not endorsed by or affiliated with Riot Games, Inc. VALORANT, League of Legends, and Riot Games are trademarks or registered trademarks of Riot Games, Inc.*
