const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Get GitHub token from git credential helper
const credsRaw = execSync('git credential fill', { input: 'protocol=https\nhost=github.com\n' }).toString();
let token = '';
for (const line of credsRaw.split('\n')) {
  if (line.startsWith('password=')) {
    token = line.slice(9).trim();
    break;
  }
}

if (!token) {
  console.error('No token found');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const repo = '24Quary24/Riot-Account-Switcher';
const tag = 'v' + pkg.version;
const releaseName = 'Riot Account Switcher ' + tag;
const body = `### Changes in v1.5.1

- **Fixed Login Automation**: Reliable, instantaneous credential entry using direct clipboard paste without dropped characters.
- **Prevented Third-Party Social Logins**: Completely removed post-password tab navigation to guarantee Google, Facebook, Apple, and Xbox logins can never be accidentally triggered.
- **Direct Form Submission**: Credential form is submitted directly via form Enter key.
- **Eliminated Handle Leaks**: Removed unmanaged desktop handle leaks that previously caused password input to cut off midway.
- **Strict Process Filtering**: Improved window discovery to explicitly filter out the Switcher process itself.`;

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
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
  console.log('Creating GitHub release for ' + tag + '...');
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

  console.log('Create release status:', createRes.statusCode);
  const release = JSON.parse(createRes.body);
  if (!release.id) {
    console.error('Failed to create release:', createRes.body);
    process.exit(1);
  }
  console.log('Release ID:', release.id);

  // Upload asset: release/Riot Account Switcher.exe as Riot-Account-Switcher.exe
  const exePath = path.join(__dirname, '..', 'release', 'Riot Account Switcher.exe');
  const fileStat = fs.statSync(exePath);
  console.log('Uploading binary: ' + exePath + ' (' + fileStat.size + ' bytes)...');

  const uploadUrl = new URL(release.upload_url.replace(/\{(\?.*)?\}/, ''));
  uploadUrl.searchParams.set('name', 'Riot-Account-Switcher.exe');

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
    res.on('data', c => d += c);
    res.on('end', () => {
      console.log('Upload status:', res.statusCode);
      try {
        const resJson = JSON.parse(d);
        console.log('Asset URL:', resJson.browser_download_url || resJson.url);
      } catch {
        console.log('Response:', d);
      }
    });
  });

  uploadReq.on('error', (err) => console.error('Upload error:', err));
  fs.createReadStream(exePath).pipe(uploadReq);
})();
