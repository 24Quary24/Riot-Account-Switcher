# Riot Account Switcher

A secure desktop application wrapper for managing multiple Riot Games accounts across VALORANT and League of Legends. Switch accounts with a single click, automatically synchronize real-time in-game statistics directly from the Riot Client, and monitor regional server latency.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6.svg)](https://microsoft.com/windows)
[![Release](https://img.shields.io/github/v/release/24Quary24/Riot-Account-Switcher?color=00B2A9)](https://github.com/24Quary24/Riot-Account-Switcher/releases)
[![Binary Download](https://img.shields.io/badge/Download-v1.0.0%20.exe-E8402A?style=flat&logo=windows)](https://github.com/24Quary24/Riot-Account-Switcher/releases/download/v1.0.0/Riot-Account-Switcher.exe)

---

## Overview

Riot Account Switcher streamlines account management for players with multiple Riot accounts. It eliminates manual logout/login cycles by securely automating credential submission and process launch, while pulling real-time profile data, ranked ratings, and currencies without requiring third-party API keys.

---

## Key Features

### Fast Account Switching
- Switch between saved Riot accounts with a single click.
- Automatically launches VALORANT or League of Legends using the selected profile.
- Process management terminates conflicting client instances gracefully before launching.
- Secure credential injection pipes authentication data directly to standard input (`stdin`), avoiding exposure in process arguments.

### Real-Time Client Statistics
- Direct integration with local Riot Client lockfile endpoints (`%LOCALAPPDATA%\Riot Games\Riot Client\Config\lockfile`).
- **VALORANT**:
  - Account Level (accurate XP progression directly from Riot endpoints).
  - Current Competitive Rank, Rank Rating (RR), and Peak Rank.
  - Accurate Unranked detection for accounts under Level 20.
  - Live Currencies: Valorant Points (VP), Radianite (RAD), and Kingdom Credits (KC).
  - Collection Overview: Weapon skins count and unlocked agents.
  - Recent match history with maps, agents, scores, and headshot percentages.
- **League of Legends**:
  - Summoner Level and Solo/Duo rank, LP, and winrate.
  - Flex queue rank and LP.
  - Live Currencies: Riot Points (RP) and Blue Essence (BE).
  - Collection Overview: Owned champions and skins count.
  - Top champion masteries with mastery levels and points.

### Auto-Detection
- One-click auto-detection imports the active Riot ID name, tagline (`#TAG`), and region directly from the active Riot Client session.

### Two-Factor Authentication (2FA / MFA) Support
- Account flags highlight 2FA-protected profiles.
- Integrated sign-in status prompts guide the user through completing email or authenticator verification.

### Regional Ping Monitor
- Real-time round-trip latency checks across 9 Riot cluster regions:
  - North America (NA) — Chicago
  - Europe West (EUW) — Frankfurt
  - Europe Nordic & East (EUNE) — Frankfurt
  - Korea (KR) — Seoul
  - Asia Pacific (AP) — Singapore
  - Brazil (BR) — São Paulo
  - Latin America North (LAN) — Mexico City
  - Latin America South (LAS) — Santiago
  - Oceania (OCE) — Sydney

### System Tray Integration
- Minimizes to the Windows taskbar notification tray.
- Context menu supports quick account switching and direct game launch without opening the main window.

---

## Security Architecture

The application is designed following least-privilege and zero-trust local storage principles.

| Component | Security Mechanism |
|---|---|
| **Credentials at Rest** | Passwords are encrypted using Windows DPAPI via Electron's `safeStorage` API, hardware-bound to the user's OS profile. |
| **Credential Injection** | Authentication strings are transmitted exclusively via PowerShell standard input (`stdin`). No plain-text passwords appear in command-line arguments or process inspection tools. |
| **Keystroke Sanitization** | SendKeys modifier sequences (`+`, `^`, `%`, `~`, `{}`, `[]`) are escaped and bracketed to prevent injection vulnerabilities. |
| **Vault Backups** | Encrypted JSON backups use AES-256-GCM authenticated encryption with PBKDF2 key derivation (100,000 rounds). |
| **File Permissions** | Configuration and credential stores are written with restricted file permissions (`mode: 0o600`). |
| **Renderer Isolation** | The user interface runs in a sandboxed context (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`). Navigation is strictly restricted to local assets. |

---

## Installation & Usage

### Standalone Binary (Recommended)
1. Download **`Riot-Account-Switcher.exe`** from the [Releases page](https://github.com/24Quary24/Riot-Account-Switcher/releases).
2. Double-click the executable to launch. No installer or runtime dependencies are required.

### Building from Source

Prerequisites: Node.js 18 or higher.

```bash
# Clone the repository
git clone https://github.com/24Quary24/Riot-Account-Switcher.git
cd Riot-Account-Switcher

# Install dependencies
npm install

# Run in development mode
npm run dev

# Compile TypeScript and bundle frontend
npm run build

# Package standalone portable Windows executable
npx electron-builder --win portable
```

---

## Project Structure

```
.
├── assets/                  # Application and system tray icons
├── electron/
│   ├── main.ts              # Electron main process and IPC dispatch
│   ├── preload.ts           # Context isolation bridge
│   ├── types.ts             # Core data interfaces
│   └── services/
│       ├── launcher.ts      # Client execution and STDIN injection
│       ├── pingService.ts   # Regional latency measurement
│       ├── riotApi.ts       # Local Riot Client lockfile & API integration
│       └── storage.ts       # DPAPI encrypted credential vault
├── src/
│   ├── components/          # React UI components
│   ├── App.tsx              # Application shell and state
│   ├── index.css            # Tactical theme styling
│   └── theme.css            # Color tokens and design variables
├── package.json             # Build scripts and electron configuration
└── tsconfig.json            # TypeScript configuration
```

---

## License

This project is licensed under the MIT License. See the [`LICENSE`](./LICENSE) file for details.

---

## Disclaimer

Riot Account Switcher is an independent community utility and is not affiliated with, endorsed by, or sponsored by Riot Games, Inc. VALORANT, League of Legends, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
