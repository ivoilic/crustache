import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/** @see https://semver.org/#is-there-a-suggested-regular-expression-to-check-a-semver-string */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const packages = [
  { packageJson: 'packages/crustache/package.json', cargoToml: 'packages/crustache/Cargo.toml' },
  {
    packageJson: 'packages/wasm-crustache/package.json',
    cargoToml: 'packages/wasm-crustache/Cargo.toml',
  },
];

const assertValidSemver = (version, pkgPath) => {
  if (typeof version !== 'string' || !version.trim()) {
    throw new Error(`Missing or invalid "version" in ${pkgPath}: ${JSON.stringify(version)}`);
  }
  const v = version.trim();
  if (!SEMVER_RE.test(v)) {
    throw new Error(`Invalid semver in ${pkgPath}: ${JSON.stringify(version)}`);
  }
};

for (const { packageJson, cargoToml } of packages) {
  const pkgPath = resolve(root, packageJson);
  const cargoPath = resolve(root, cargoToml);

  const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
  assertValidSemver(version, pkgPath);

  const cargo = readFileSync(cargoPath, 'utf8');
  const versionLine = /^version\s*=\s*"[^"]*"/m;
  if (!versionLine.test(cargo)) {
    throw new Error(
      `No Cargo.toml version line matched /^version\\s*=\\s*"[^"]*"/m in ${cargoPath} (from ${pkgPath}, package version ${JSON.stringify(version)})`,
    );
  }

  const updated = cargo.replace(versionLine, `version = "${version}"`);

  if (updated !== cargo) {
    writeFileSync(cargoPath, updated, 'utf8');
    console.log(`Updated ${cargoToml} to version ${version}`);
  } else {
    console.log(`Already in sync: ${cargoToml} at ${version}`);
  }
}
