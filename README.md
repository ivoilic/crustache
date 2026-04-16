# crustache

Rust implementation of the Mustache template language along with a WASM version.

Repository: [github.com/ivoilic/crustache](https://github.com/ivoilic/crustache)

## Packages

### [packages/crustache](packages/crustache)

### [packages/wasm-crustache](packages/wasm-crustache)

#### Installation
```bash
pnpm i wasm-crustache
# or
npm install wasm-crustache
```

#### Usage
```ts
import { Template, render } from 'wasm-crustache';

// Render mustache syntax
const oneShot = await render('Hello {{name}}!', { name: 'Mercury' });

console.log(oneShot);

// Create a resuable mustache template
const template = await Template.compile('{{#planets}}{{name}} {{/planets}}');

// Render the mustache template
const reusable = template.render({
  planets: [{ name: 'Earth' }, { name: 'Mars' }, { name: 'Jupiter' }],
});

console.log(reusable);
```

## Contributing

### Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) at the **repository root** (`.changeset/` and `@changesets/cli` on the root `package.json`), as recommended for monorepos.

| Step | Command |
|------|---------|
| Add a changeset | `pnpm changeset` |
| Version packages & changelogs | `pnpm changeset:version` |
| Publish to npm | `pnpm changeset:publish` |

Pending changeset files live under **`.changeset/`** at the repo root. When you add a changeset, select **crustache** and/or **wasm-crustache** as needed.

**crustache** has both `package.json` and `Cargo.toml`: after `changeset:version`, align **`packages/crustache/Cargo.toml`** `version` with **`packages/crustache/package.json`** before publishing to [crates.io](https://crates.io/crates/crustache).

### Building

```bash
pnpm install
pnpm run build
pnpm test
```

See [packages/wasm-crustache/README.md](packages/wasm-crustache/README.md) for install and API documentation.
