# Riot Account Switcher

A secure desktop application for managing multiple Riot Games accounts across VALORANT and League of Legends. Switch accounts with a single click.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6.svg)](https://microsoft.com/windows)
[![Release](https://img.shields.io/github/v/release/24Quary24/Riot-Account-Switcher?color=00B2A9)](https://github.com/24Quary24/Riot-Account-Switcher/releases)
[![Download](https://img.shields.io/badge/Download-.exe-E8402A?style=flat&logo=windows)](https://github.com/24Quary24/Riot-Account-Switcher/releases)
[![Built with AI](https://img.shields.io/badge/Built%20with-Gemini%20AI-4285F4.svg?style=flat&logo=google)](https://deepmind.google/technologies/gemini/)

---

## Overview

Riot Account Switcher eliminates the manual login/logout cycle for players with multiple Riot accounts. Save your accounts securely, then launch VALORANT or League of Legends under any saved profile with a single click.

---

## Features

### One-Click Account Switching
- Instantly switch between saved Riot accounts.
- Automatically launches VALORANT or League of Legends using the selected credentials.
- Gracefully terminates conflicting client instances before launching the new one.
- Credentials are injected securely via `stdin` — never exposed in process arguments.

### Secure Credential Storage
- Passwords are encrypted at rest using Windows DPAPI via Electron's `safeStorage` API, hardware-bound to your OS user profile.
- Encrypted vault backup and restore (AES-256-GCM, PBKDF2 key derivation).
- Configuration files are written with restricted permissions (`mode: 0o600`).

### Two-Factor Authentication (2FA)
- Mark accounts as 2FA-protected to display a badge as a reminder.

### Regional Ping Monitor
- Live round-trip latency checks across 9 Riot server regions (NA, EUW, EUNE, KR, AP, BR, LAN, LAS, OCE).

### System Tray
- Minimize to the Windows system tray. The app stays running in the background until you need to switch accounts.

---

## Security

| Component | Mechanism |
|---|---|
| **Credentials at Rest** | Windows DPAPI via Electron `safeStorage`, hardware-bound to the OS user profile. |
| **Credential Injection** | Transmitted exclusively via `stdin`. No plain-text passwords in process arguments. |
| **Vault Backups** | AES-256-GCM authenticated encryption with PBKDF2 (100,000 rounds). |
| **Renderer Isolation** | `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`. Navigation restricted to local assets. |

---

## Installation

### Download (Recommended)
1. Download **`Riot-Account-Switcher.exe`** from the [Releases page](https://github.com/24Quary24/Riot-Account-Switcher/releases).
2. Run the executable. No installer or dependencies required.

### Build from Source

Requires Node.js 18+.

```bash
git clone https://github.com/24Quary24/Riot-Account-Switcher.git
cd Riot-Account-Switcher
npm install
npm run dev          # Development mode
npm run build        # Production build
npx electron-builder --win portable  # Package as .exe
```

---

## Project Structure

```
.
├── assets/                  # App icons
├── electron/
│   ├── main.ts              # Electron main process and IPC
│   ├── preload.ts           # Context isolation bridge
│   └── services/
│       ├── launcher.ts      # Client execution and stdin injection
│       ├── pingService.ts   # Regional latency checks
│       └── storage.ts       # DPAPI encrypted credential vault
├── src/
│   ├── components/          # React UI components
│   ├── App.tsx              # Application shell and state
│   └── index.css            # Styling
└── package.json
```

---

## Contributors

- **Author**: [24Quary24](https://github.com/24Quary24)
- **AI Engineering Partner**: Built in collaboration with [Gemini](https://deepmind.google/technologies/gemini/) (Google DeepMind)

---

## License

MIT License. See [`LICENSE`](./LICENSE) for details.

---

## Disclaimer

Riot Account Switcher is an independent community utility. It is not affiliated with, endorsed by, or sponsored by Riot Games, Inc. VALORANT, League of Legends, and all associated properties are trademarks of Riot Games, Inc.
