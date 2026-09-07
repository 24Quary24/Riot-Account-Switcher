const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Get GitHub token from git credential helper or environment
let token = process.env.GITHUB_TOKEN || '';
if (!token) {
  try {
    const credsRaw = execSync('git credential fill', { input: 'protocol=https\nhost=github.com\n' }).toString();
    for (const line of credsRaw.split('\n')) {
      if (line.startsWith('password=')) {
        token = line.slice(9).trim();
        break;
      }
    }
  } catch (e) {
    console.error('Failed to query git credential helper:', e.message);
  }
}

if (!token) {
  console.error('[ERROR] No GitHub token found. Please set GITHUB_TOKEN or configure git credentials.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const repo = '24Quary24/Riot-Account-Switcher';
const tag = 'v' + pkg.version;
const releaseName = 'Riot Account Switcher ' + tag;

// 2. Locate built executable
const candidateExePaths = [
  path.join(__dirname, '..', 'release', 'Riot Account Switcher.exe'),
  path.join(__dirname, '..', 'Riot Account Switcher.exe'),
];

let exePath = candidateExePaths.find((p) => fs.existsSync(p));
if (!exePath) {
  console.error('[ERROR] Compiled executable not found! Please build it first with:');
  console.error('  npm run dist:portable');
  process.exit(1);
}

const fileStat = fs.statSync(exePath);
console.log(`Found binary: ${exePath} (${(fileStat.size / (1024 * 1024)).toFixed(2)} MB)`);

// If the binary in release exists and is newer than root binary, copy to root
const rootExe = path.join(__dirname, '..', 'Riot Account Switcher.exe');
const releaseExe = path.join(__dirname, '..', 'release', 'Riot Account Switcher.exe');
if (fs.existsSync(releaseExe)) {
  try {
    fs.copyFileSync(releaseExe, rootExe);
    console.log(`Synchronized binary to root: ${rootExe}`);
  } catch (e) {
    console.warn(`Could not sync to root (may be in use): ${e.message}`);
  }
}

const body = `### Riot Account Switcher ${tag}

> [!WARNING]
> **Active Testing Notice**: Riot Account Switcher is currently in **active testing & continuous development**. Automated input detection relies on OS window focus and Riot Client CEF web rendering. Silent session switching is recommended for daily use.

#### Highlights & New Features in ${tag}:
- **Official Installation Auto-Discovery**: Automatically queries \`C:\\ProgramData\\Riot Games\\RiotClientInstalls.json\` to detect Riot Client, Valorant, and League of Legends across any custom drive letter (D:, E:, etc.) with zero manual configuration needed.
- **In-Game Match Safety Guard**: Prevents accidental AFK bans or ranked queue dodges! Detects active matches (\`VALORANT-Win64-Shipping.exe\`, \`VALORANT.exe\`, \`League of Legends.exe\`) and prompts you for confirmation before terminating processes or switching profiles.
- **Active Session Auto-Fill**: In the Add/Edit Account dialog, click **"Auto-Fill from Active Riot Session"** to instantly grab your currently logged-in Riot ID, Tagline, PUUID, and region without manual typing.
- **Account Sorting & Quick Filters**: Sort your roster by Recently Played, Highest Rank (Radiant/Challenger down to Iron), Region, or Account Name (A–Z). Filter with a single click using the **⚡ Silent Ready** pill.
- **Custom Account Tags & Notes**: Categorize your accounts with custom tags (e.g. *Main*, *Smurf*, *Duo*, *Tournament*) and private notes, displayed prominently on account cards.
- **Live Active Account Glow**: The account currently active in Riot Client is now badged with **● Active** and a distinct green accent glow.
- **Batch Refresh All**: Refresh live ranks, match histories, and LP for your entire account roster simultaneously from the top navigation bar.
- **Start with Windows**: Added an option in Settings to launch Riot Account Switcher automatically on system startup.
- **Enhanced System Tray**: Shows active accounts and silent-ready badges directly from the Windows taskbar context menu.
- **30-Day 2FA Trusted Device Persistence (\`tdid\`) & PSL Session Engine**: Retained and polished all core persistent session engine features.`;

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, headers: res.headers, body: buf.toString('utf8') });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  console.log('Checking / creating GitHub release for ' + tag + '...');
  let release = null;

  // Try creating release
  const createRes = await request({
    hostname: 'api.github.com',
    path: '/repos/' + repo + '/releases',
    method: 'POST',
    headers: {
      'User-Agent': 'Riot-Account-Switcher-Release-Script',
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    }
  }, JSON.stringify({
    tag_name: tag,
    name: releaseName,
    body: body,
    draft: false,
    prerelease: false
  }));

  if (createRes.statusCode === 201) {
    release = JSON.parse(createRes.body);
    console.log('Created release ID:', release.id);
  } else if (createRes.statusCode === 422) {
    // Release or tag might already exist, fetch it
    console.log(`Release or tag ${tag} already exists. Fetching existing release...`);
    const getRes = await request({
      hostname: 'api.github.com',
      path: `/repos/${repo}/releases/tags/${tag}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Riot-Account-Switcher-Release-Script',
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json',
      }
    });
    if (getRes.statusCode === 200) {
      release = JSON.parse(getRes.body);
      console.log('Found existing release ID:', release.id);
    } else {
      console.error('Failed to retrieve existing release:', getRes.body);
      process.exit(1);
    }
  } else {
    console.error('Failed to create release:', createRes.statusCode, createRes.body);
    process.exit(1);
  }

  // Check if an asset named Riot-Account-Switcher.exe already exists on this release
  if (release.assets && release.assets.length > 0) {
    const existingAsset = release.assets.find((a) => a.name === 'Riot-Account-Switcher.exe');
    if (existingAsset) {
      console.log(`Asset ${existingAsset.name} already exists (ID: ${existingAsset.id}). Deleting before re-upload...`);
      const delRes = await request({
        hostname: 'api.github.com',
        path: `/repos/${repo}/releases/assets/${existingAsset.id}`,
        method: 'DELETE',
        headers: {
          'User-Agent': 'Riot-Account-Switcher-Release-Script',
          'Authorization': 'token ' + token,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      console.log('Delete status:', delRes.statusCode);
    }
  }

  // Upload asset: Riot-Account-Switcher.exe
  console.log('Uploading asset binary: ' + exePath + ' (' + fileStat.size + ' bytes)...');
  const uploadUrl = new URL(release.upload_url.replace(/\{(\?.*)?\}/, ''));
  uploadUrl.searchParams.set('name', 'Riot-Account-Switcher.exe');

  await new Promise((resolve, reject) => {
    const uploadReq = https.request({
      hostname: uploadUrl.hostname,
      path: uploadUrl.pathname + uploadUrl.search,
      method: 'POST',
      headers: {
        'User-Agent': 'Riot-Account-Switcher-Release-Script',
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileStat.size
      }
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        console.log('Upload response status:', res.statusCode);
        try {
          const resJson = JSON.parse(d);
          if (resJson.browser_download_url) {
            console.log('Asset successfully published at:', resJson.browser_download_url);
            resolve(resJson);
          } else {
            console.log('Upload result:', d);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(resJson);
            } else {
              reject(new Error(`Upload failed with status ${res.statusCode}: ${d}`));
            }
          }
        } catch {
          console.log('Response:', d);
          resolve(d);
        }
      });
    });

    uploadReq.on('error', (err) => {
      console.error('Upload error:', err);
      reject(err);
    });

    fs.createReadStream(exePath).pipe(uploadReq);
  });

  console.log(`\n=== Release ${tag} successfully published to GitHub! ===`);
})().catch((err) => {
  console.error('Release failed:', err);
  process.exit(1);
});
