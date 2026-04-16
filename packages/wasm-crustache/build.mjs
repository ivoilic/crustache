import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const distPath = resolve(packageRoot, 'dist');
const pkgPath = resolve(packageRoot, 'pkg');

const run = (command, args, options = {}) => {
  execFileSync(command, args, { cwd: packageRoot, stdio: 'inherit', ...options });
};

const resetDirectories = () => {
  rmSync(distPath, { force: true, recursive: true });
  rmSync(pkgPath, { force: true, recursive: true });
  mkdirSync(distPath, { recursive: true });
  mkdirSync(resolve(distPath, 'wasm'), { recursive: true });
};

const buildWasmTargets = () => {
  run('pnpm', ['run', 'build:wasm:bundler']);
  run('pnpm', ['run', 'build:wasm:node']);
};

const buildTypeScript = () => {
  run('pnpm', ['run', 'build:esm']);
  run('pnpm', ['run', 'build:cjs']);
  run('pnpm', ['run', 'build:types']);
};

const assembleDist = () => {
  cpSync(resolve(pkgPath, 'bundler'), resolve(distPath, 'wasm', 'bundler'), {
    force: true,
    recursive: true,
  });
  cpSync(resolve(pkgPath, 'node'), resolve(distPath, 'wasm', 'node'), {
    force: true,
    recursive: true,
  });

  copyFileSync(resolve(distPath, 'esm', 'index.js'), resolve(distPath, 'index.mjs'));
  copyFileSync(resolve(distPath, 'cjs', 'index.js'), resolve(distPath, 'index.cjs'));
  copyFileSync(resolve(distPath, 'types', 'index.d.ts'), resolve(distPath, 'index.d.ts'));

  rmSync(resolve(distPath, 'esm'), { force: true, recursive: true });
  rmSync(resolve(distPath, 'cjs'), { force: true, recursive: true });
  rmSync(resolve(distPath, 'types'), { force: true, recursive: true });
};

const ensureWasmPackAvailable = () => {
  try {
    run('wasm-pack', ['--version']);
  } catch {
    throw new Error(
      'wasm-pack is required but not installed. Install it from https://rustwasm.github.io/wasm-pack/installer/',
    );
  }
};

const main = () => {
  if (!existsSync(resolve(packageRoot, 'package.json'))) {
    throw new Error('package.json not found in package root.');
  }

  ensureWasmPackAvailable();
  resetDirectories();
  buildWasmTargets();
  buildTypeScript();
  assembleDist();
};

main();
