#!/usr/bin/env node
/**
 * Deploy the generated Hexo site to origin/master.
 *
 * The repository keeps source on `src` and the generated static site on
 * `master`. This script mirrors `public/` into a temporary worktree of
 * `origin/master`, commits it as "Site updated: ..." and pushes, which is what
 * triggers the static deployment.
 *
 * Usage:
 *   npm run deploy                 # build, commit and push
 *   npm run deploy:fast            # deploy the existing public/ directory
 *   npm run deploy:dry             # build + prepare commit, but do not push
 *   npm run deploy -- --allow-dirty
 *   npm run deploy -- --skip-build --keep-temp
 *
 * Set DEPLOY_SSH_COMMAND if SSH needs a custom configuration, e.g.:
 *   DEPLOY_SSH_COMMAND='ssh -F ~/.ssh/config' npm run deploy
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const REMOTE = 'origin';
const TARGET = 'master';
const IS_WINDOWS = process.platform === 'win32';

const TOOLING_FILES = new Set([
  'package.json',
  'package-lock.json',
  'bin/deploy-master.js'
]);

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

let tempDir = '';
let tempCreated = false;
let keepTemp = options.keepTemp;

process.on('SIGINT', () => {
  console.error('\n已中断');
  cleanupWorktree();
  process.exit(130);
});

main()
  .catch((error) => {
    console.error(`\n部署失败: ${error.message}`);
    if (tempCreated && keepTemp) {
      console.error(`临时工作区保留在: ${tempDir}`);
    }
    process.exitCode = 1;
  })
  .finally(() => {
    cleanupWorktree();
  });


/* -------------------------------------------------------------------------- */
/* arguments                                                                  */
/* -------------------------------------------------------------------------- */

function parseArgs(argv) {
  const parsed = {
    help: false,
    dryRun: false,
    skipBuild: false,
    allowDirty: false,
    keepTemp: false
  };

  for (const arg of argv) {
    switch (arg) {
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '--skip-build':
      case '--no-build':
        parsed.skipBuild = true;
        break;
      case '--allow-dirty':
        parsed.allowDirty = true;
        break;
      case '--keep-temp':
        parsed.keepTemp = true;
        break;
      default:
        console.error(`未知参数: ${arg}\n`);
        printHelp();
        process.exit(1);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`用法: npm run deploy [-- 参数]

将 public/ 发布到 ${REMOTE}/${TARGET}，提交信息为 "Site updated: 时间"。
推送成功会触发 Vercel/GitHub Pages 等静态部署。

参数:
  --skip-build      跳过 hexo clean/generate，直接部署现有 public/
  --dry-run         构建并准备提交，但不 commit、不 push
  --allow-dirty     允许有未提交的源文件改动（默认会阻止）
  --keep-temp       保留临时 master 工作区，便于排查失败
  -h, --help        显示本帮助

npm scripts:
  npm run deploy       构建并部署
  npm run deploy:fast  跳过构建，部署当前 public/
  npm run deploy:dry   只演练，不推送

环境变量:
  DEPLOY_SSH_COMMAND   自定义 git 使用的 ssh 命令
`);
}

/* -------------------------------------------------------------------------- */
/* process helpers                                                            */
/* -------------------------------------------------------------------------- */

function logStep(title, message) {
  console.log(`\n==> ${title}${message ? `：${message}` : ''}`);
}

function warn(message) {
  console.warn(`[warn] ${message}`);
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd || ROOT,
    env: { ...process.env, ...(opts.env || {}) },
    encoding: 'utf8',
    stdio: opts.stdio || 'pipe',
    shell: Boolean(opts.shell)
  });

  if (result.error) {
    throw new Error(`无法执行 ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout]
      .filter(Boolean)
      .join('\n')
      .trim();
    throw new Error(
      `${command} ${args.join(' ')} 失败` + (detail ? `\n${detail}` : '')
    );
  }
  return result;
}

function git(args, opts = {}) {
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0'
  };
  const sshOverride = process.env.DEPLOY_SSH_COMMAND || process.env.GIT_SSH_COMMAND;
  if (sshOverride) env.GIT_SSH_COMMAND = sshOverride;

  const cwd = opts.cwd || ROOT;
  const spawnGit = () =>
    spawnSync('git', args, {
      cwd,
      env,
      encoding: 'utf8',
      stdio: 'pipe'
    });

  let result = spawnGit();

  // Some systems ship an SSH config include with broken ownership. Retry with
  // an empty config, unless the user explicitly supplied an SSH command.
  if (
    opts.network &&
    !sshOverride &&
    result.status !== 0 &&
    /Bad owner or permissions|ssh_config/i.test(result.stderr || '')
  ) {
    const nullConfig = IS_WINDOWS ? 'NUL' : '/dev/null';
    warn('检测到 SSH 系统配置权限异常，改用 ssh -F ' + nullConfig + ' 重试');
    env.GIT_SSH_COMMAND = `ssh -F ${nullConfig}`;
    result = spawnGit();
  }

  if (result.error) {
    throw new Error(`无法执行 git: ${result.error.message}`);
  }
  if (result.status !== 0) {
    if (opts.allowFail) return '';
    const detail = [result.stderr, result.stdout]
      .filter(Boolean)
      .join('\n')
      .trim();
    throw new Error(
      `git ${args.join(' ')} 失败` + (detail ? `\n${detail}` : '')
    );
  }

  return (result.stdout || '').trim();
}

function formatDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') +
    ' ' +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(':');
}

/* -------------------------------------------------------------------------- */
/* checks                                                                     */
/* -------------------------------------------------------------------------- */

function readLines(output) {
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function isToolingFile(file) {
  return TOOLING_FILES.has(file.replace(/\\/g, '/'));
}

function assertCleanSource() {
  const changed = new Set();
  for (const args of [
    ['diff', '--name-only'],
    ['diff', '--cached', '--name-only'],
    ['ls-files', '--others', '--exclude-standard']
  ]) {
    for (const file of readLines(git(args))) {
      const normalized = file.replace(/\\/g, '/');
      if (!isToolingFile(normalized)) changed.add(normalized);
    }
  }

  if (!changed.size) return;

  if (!options.allowDirty) {
    console.error('\n检测到未提交的源文件改动：');
    for (const file of [...changed].sort()) console.error(`  - ${file}`);
    console.error(
      '\n请先 commit，或使用 `npm run deploy -- --allow-dirty` 强制部署当前工作区。'
    );
    throw new Error('工作区不是干净的');
  }

  warn('工作区有未提交改动，按 --allow-dirty 继续：');
  for (const file of [...changed].sort()) console.warn(`  - ${file}`);
}

function assertEnvironment() {
  const inside = git(['rev-parse', '--is-inside-work-tree']);
  if (inside !== 'true') {
    throw new Error('当前目录不是 git 工作区');
  }

  const top = git(['rev-parse', '--show-toplevel']);
  if (path.resolve(top) !== ROOT) {
    throw new Error(`脚本需要在仓库根目录运行（当前: ${ROOT}）`);
  }

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch === TARGET) {
    throw new Error(`当前在 ${TARGET} 分支，请切回 src 后再部署`);
  }
  if (branch !== 'src') {
    warn(`当前分支是 ${branch}，不是 src，仍按当前构建部署`);
  }

  const remoteUrl = git(['remote', 'get-url', REMOTE]);
  if (!remoteUrl) {
    throw new Error(`没有找到 remote ${REMOTE}`);
  }

  console.log(`仓库: ${ROOT}`);
  console.log(`分支: ${branch} -> ${REMOTE}/${TARGET}`);
  console.log(`远端: ${remoteUrl}`);

  assertCleanSource();
}

/* -------------------------------------------------------------------------- */
/* build / deploy                                                             */
/* -------------------------------------------------------------------------- */

function buildSite() {
  if (options.skipBuild) {
    warn('已跳过 hexo clean/generate，使用当前 public/ 目录');
  } else {
    const hexoBin = path.join(
      ROOT,
      'node_modules',
      '.bin',
      IS_WINDOWS ? 'hexo.cmd' : 'hexo'
    );
    if (!fs.existsSync(hexoBin)) {
      throw new Error('找不到 node_modules/.bin/hexo，请先运行 npm install');
    }

    logStep('构建', 'hexo clean && hexo generate');
    run(hexoBin, ['clean'], {
      stdio: 'inherit',
      shell: IS_WINDOWS
    });
    run(hexoBin, ['generate'], {
      stdio: 'inherit',
      shell: IS_WINDOWS
    });
  }

  const index = path.join(PUBLIC_DIR, 'index.html');
  if (!fs.existsSync(index) || fs.statSync(index).size === 0) {
    throw new Error('public/index.html 不存在或为空，构建可能失败');
  }
}

function makeTempDir() {
  const base = path.join(
    os.tmpdir(),
    `hexo-${TARGET}-${Date.now()}-${process.pid}`
  );
  let candidate = base;
  let suffix = 0;
  while (fs.existsSync(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

function copySite(destination) {
  for (const entry of fs.readdirSync(PUBLIC_DIR)) {
    fs.cpSync(
      path.join(PUBLIC_DIR, entry),
      path.join(destination, entry),
      { recursive: true, force: true }
    );
  }
}

function cleanupWorktree() {
  if (!tempCreated) return;

  if (keepTemp) {
    console.log(`\n临时 master 工作区保留在: ${tempDir}`);
    return;
  }

  try {
    git(['worktree', 'remove', '--force', tempDir], { allowFail: true });
  } catch (error) {
    // fall through to rmSync
  }
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (error) {
    // ignore cleanup errors
  }
  try {
    git(['worktree', 'prune'], { allowFail: true });
  } catch (error) {
    // ignore cleanup errors
  }

  tempCreated = false;
}

function deploySite() {
  logStep('同步', `git fetch ${REMOTE} ${TARGET}`);
  git(['fetch', REMOTE, TARGET], { network: true });

  tempDir = makeTempDir();
  tempCreated = true;
  logStep('准备 master', tempDir);
  git(['worktree', 'add', '--detach', tempDir, `${REMOTE}/${TARGET}`]);

  // Replace the tracked deployment output with the fresh public/ directory.
  git(['rm', '-r', '--quiet', '.'], { cwd: tempDir });
  copySite(tempDir);
  git(['add', '-A'], { cwd: tempDir });

  const changed = git(['diff', '--cached', '--stat'], { cwd: tempDir });
  console.log(changed || '  (站点内容没有变化，将创建一个空提交以触发部署)');

  if (options.dryRun) {
    console.log('\n[dry-run] 已完成构建和暂存，但没有 commit / push。');
    return;
  }

  const message = `Site updated: ${formatDate(new Date())}`;
  git(['commit', '--allow-empty', '-m', message], { cwd: tempDir });
  const sha = git(['rev-parse', '--short', 'HEAD'], { cwd: tempDir });

  logStep('推送', `${sha} -> ${REMOTE}/${TARGET}`);
  git(['push', REMOTE, `HEAD:${TARGET}`], {
    cwd: tempDir,
    network: true
  });

  // Keep the local master ref in sync when it is not the checked-out branch.
  try {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch !== TARGET) {
      git(['fetch', REMOTE, `${TARGET}:${TARGET}`], { network: true });
    }
  } catch (error) {
    warn('本地 master 引用未同步，下次 fetch 时会更新');
  }

  console.log(`\n✓ 已部署到 ${REMOTE}/${TARGET}`);
  console.log(`  commit: ${sha}`);
  console.log(`  message: ${message}`);

  const url = getSiteUrl();
  if (url) console.log(`  站点:   ${url}`);
}

function getSiteUrl() {
  try {
    const config = fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8');
    const match = config.match(/^url:\s*['"]?([^'"\s#]+)/m);
    return match ? match[1].replace(/\/+$/, '') : '';
  } catch (error) {
    return '';
  }
}

/* -------------------------------------------------------------------------- */
/* main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log('Hexo 部署脚本');
  console.log(`目标: ${REMOTE}/${TARGET}`);

  assertEnvironment();
  buildSite();
  deploySite();
}
