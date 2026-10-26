import { existsSync, mkdirSync, openSync, closeSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const address = 'http://127.0.0.1:3014';
const runtime = join(root, '.maintenance', 'local-ai-runtime');
mkdirSync(runtime, { recursive: true });
async function reachable(url, options = {}) {
  try { return await fetch(url, { ...options, signal: AbortSignal.timeout(1000) }); } catch { return null; }
}
function background(exe, args, logName, env = process.env) {
  const log = openSync(join(runtime, logName), 'a');
  const child = spawn(exe, args, { cwd: root, env, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  child.on('error', error => console.error(error.message));
  child.unref(); closeSync(log);
}
if (!await reachable('http://127.0.0.1:11434/api/tags')) {
  const exe = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Ollama', 'ollama.exe');
  if (existsSync(exe)) background(exe, ['serve'], 'ollama.log', { ...process.env, OLLAMA_HOST: '127.0.0.1:11434', OLLAMA_NO_CLOUD: '1', OLLAMA_MAX_LOADED_MODELS: '1', OLLAMA_NUM_PARALLEL: '1' });
}
if (!await reachable(address)) {
  const next = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  if (!existsSync(next)) throw new Error('Сначала выполните npm ci в папке ежедневника.');
  const env = { ...process.env, GITHUB_PAGES: 'false', NEXT_PUBLIC_BASE_PATH: '' };
  let serverBuild = false;
  try { serverBuild = existsSync(join(root, '.next', 'BUILD_ID')) && JSON.parse(readFileSync(join(root, '.next', 'required-server-files.json'), 'utf8')).config.output !== 'export'; } catch {}
  if (!serverBuild) {
    const built = spawnSync(process.execPath, [next, 'build'], { cwd: root, env, windowsHide: true, stdio: 'inherit' });
    if (built.status !== 0) throw new Error('Не удалось собрать локальный ежедневник.');
  }
  background(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', '3014'], 'app.log', env);
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await reachable(address)) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
if (!await reachable(address)) throw new Error('Локальный ежедневник не запустился. Подробности: .maintenance/local-ai-runtime/app.log');
if (!process.argv.includes('--no-open')) {
  const candidates = [join(process.env.ProgramFiles ?? '', 'Google/Chrome/Application/chrome.exe'), join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft/Edge/Application/msedge.exe')];
  const browser = candidates.find(existsSync);
  if (browser) { const child = spawn(browser, ['--profile-directory=Default', `--app=${address}`], { windowsHide: true, detached: true, stdio: 'ignore' }); child.unref(); }
}
console.log(`Ежедневник с локальным ИИ: ${address}`);
