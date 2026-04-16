import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const packages = [
  { packageJson: 'packages/crustache/package.json', cargoToml: 'packages/crustache/Cargo.toml' },
  {
    packageJson: 'packages/wasm-crustache/package.json',
    cargoToml: 'packages/wasm-crustache/Cargo.toml',
  },
];

for (const { packageJson, cargoToml } of packages) {
  const pkgPath = resolve(root, packageJson);
  const cargoPath = resolve(root, cargoToml);

  const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const cargo = readFileSync(cargoPath, 'utf8');

  const updated = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);

  if (updated !== cargo) {
    writeFileSync(cargoPath, updated, 'utf8');
    console.log(`Updated ${cargoToml} to version ${version}`);
  } else {
    console.log(`No version change needed for ${cargoToml}`);
  }
}
