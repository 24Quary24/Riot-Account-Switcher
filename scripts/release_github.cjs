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
- **Switch Riot Client Only (No Game Launch)**: Added a dedicated 1-click option to switch profiles directly in Riot Client without forcing Valorant or League to start. Perfect for checking daily store offers, Night Market, or messaging friends.
- **Direct Tracker.gg & OP.GG Integration**: Added 1-click buttons on account cards and detail drawers to immediately view career stats, match histories, and MMR on Tracker.gg (Valorant) and OP.GG (League).
- **Account Portfolio Summary Ribbon**: Sleek overview banner above your roster displaying total profiles, ⚡ Silent Ready count, combined VP & RP currency balances, and top rank achieved.
- **Quiet Tactile UI Audio (Web Audio API)**: Zero-dependency, ultra-quiet, gentle micro-sounds for button clicks, switches, warnings, and success chimes. Fully respects the Audio Feedback toggle in Settings.
- **Quick Copy Riot ID & Secure Password**: Added quick-copy actions in the account card menu, with an automatic 30-second clipboard wipe for password security.
- **Keyboard Shortcut Badges (\`Ctrl+1\` – \`Ctrl+9\`)**: Subtle hotkey indicators on your top 9 account cards for instant switching.
- **Client Language & Custom Launch Arguments**: Select custom client locales (e.g. Japanese \`ja_JP\` or Korean \`ko_KR\` for anime/foreign voiceovers) or custom flags directly in Settings.
- **Automatic GitHub Update Checker**: Checks for new releases on startup and displays an unobtrusive update banner with a 1-click download link.`;

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
