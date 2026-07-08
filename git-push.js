const { execSync } = require('child_process');
const fs = require('fs');

const dir = '/root/.picoclaw/workspace/na-api';
const memoryRaw = fs.readFileSync('/root/.picoclaw/workspace/memory/MEMORY.md', 'utf8');
const tokenMatch = memoryRaw.match(/\| github_token_na_api \| (.+?) \|/);
const token = tokenMatch ? tokenMatch[1] : null;

if (!token) { console.error('Token not found'); process.exit(1); }

execSync('git add -A', { cwd: dir });
execSync('git -c user.name=picoclaw -c user.email=picoclaw@users.noreply.github.com commit -m "feat: tambah endpoint loadtest stockfish untuk debugging"', { cwd: dir });
execSync(`git remote set-url origin "https://picoclaw:${token}@github.com/purujawa06-bot/Na-api.git"`, { cwd: dir });
execSync('git push origin main', { cwd: dir, stdio: 'inherit' });
execSync('git remote set-url origin https://github.com/purujawa06-bot/Na-api.git', { cwd: dir });
console.log('Push selesai!');
