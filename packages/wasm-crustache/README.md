# wasm-crustache

High-performance Mustache rendering for JavaScript powered by the
[**crustache**](../crustache) Rust crate.

Repository: [github.com/ivoilic/crustache](https://github.com/ivoilic/crustache)

## Features

- Fast Rust implementation running in browser or Node.js
- Async one-shot rendering API
- Reusable compiled templates for hot-path performance
- TypeScript types included

## Install

```bash
pnpm add wasm-crustache
# or
npm install wasm-crustache
```

## Usage

```ts
import { Template, render } from 'wasm-crustache';

const oneShot = await render('Hello {{name}}!', { name: 'Mercury' });
console.log(oneShot);

const template = await Template.compile('{{#planets}}{{name}} {{/planets}}');
const reusable = template.render({
  planets: [{ name: 'Earth' }, { name: 'Mars' }, { name: 'Jupiter' }],
});
console.log(reusable);
```

## API

### `init(): Promise<void>`

Preloads and initializes the wasm module. Optional because `render` and `Template.compile` auto-init.

### `render(template: string, data: JsonValue): Promise<string>`

Compiles and renders in one call.

### `Template.compile(template: string): Promise<Template>`

Compiles a template once and returns a reusable renderer.

### `template.render(data: JsonValue): string`

Renders using an already compiled template.

## Development

### Changesets

Versioning uses [Changesets](https://github.com/changesets/changesets) from the **monorepo root** (shared `.changeset/` directory). From the repository root:

```bash
pnpm changeset
pnpm changeset:version
```

### Build and test

This package lives in a pnpm workspace. From the repository root:

Prerequisites:

- Rust toolchain (see `rust-toolchain.toml` at the repository root)
- `wasm32-unknown-unknown` target
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
- pnpm

```bash
pnpm install
pnpm --filter wasm-crustache run build
pnpm --filter wasm-crustache run test
```

Or from the repo root:

```bash
pnpm install
pnpm run build
pnpm test
```

## Limitations

- Partials are not supported in browser-friendly mode.
- JS callback lambdas are not supported.
- Data must be JSON-serializable.
