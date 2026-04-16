import { describe, expect, test } from 'vitest';

import type { JsonValue } from '../js/index.js';
import { render } from '../dist/index.mjs';

/**
 * One representative case per file under
 * https://github.com/mustache/spec/tree/master/specs
 * (names mirror official spec cases where possible).
 *
 * Partials: the official harness passes `partials` inline; crustache resolves
 * `{{>name}}` from disk at compile time. WASM has no usable host filesystem
 * during `wasm-pack` builds, so compile fails when a partial tag is present.
 * See `packages/crustache` tests for file-backed partial behavior.
 */

describe('mustache/spec — comments', () => {
  test('Inline (comments.json)', async () => {
    await expect(render('12345{{! Comment Block! }}67890', {})).resolves.toBe('1234567890');
  });

  test('Standalone (comments.json)', async () => {
    await expect(render('Begin.\n{{! Comment Block! }}\nEnd.\n', {})).resolves.toBe(
      'Begin.\nEnd.\n',
    );
  });
});

describe('mustache/spec — delimiters', () => {
  test('Pair Behavior (delimiters.json)', async () => {
    await expect(render('{{=<% %>=}}(<%text%>)', { text: 'Hey!' })).resolves.toBe('(Hey!)');
  });

  test('Special Characters (delimiters.json)', async () => {
    await expect(render('({{=[ ]=}}[text])', { text: 'It worked!' })).resolves.toBe('(It worked!)');
  });
});

describe('mustache/spec — interpolation', () => {
  test('Basic Interpolation (interpolation.json)', async () => {
    await expect(render('Hello, {{subject}}!\n', { subject: 'world' })).resolves.toBe(
      'Hello, world!\n',
    );
  });

  test('HTML Escaping (interpolation.json)', async () => {
    await expect(
      render('These characters should be HTML escaped: {{forbidden}}\n', {
        forbidden: '& " < >',
      }),
    ).resolves.toBe('These characters should be HTML escaped: &amp; &quot; &lt; &gt;\n');
  });

  test('Triple Mustache (interpolation.json)', async () => {
    await expect(
      render('These characters should not be HTML escaped: {{{forbidden}}}\n', {
        forbidden: '& " < >',
      }),
    ).resolves.toBe('These characters should not be HTML escaped: & " < >\n');
  });

  test('Ampersand (interpolation.json)', async () => {
    await expect(
      render('These characters should not be HTML escaped: {{&forbidden}}\n', {
        forbidden: '& " < >',
      }),
    ).resolves.toBe('These characters should not be HTML escaped: & " < >\n');
  });

  test('Basic Null Interpolation (interpolation.json)', async () => {
    await expect(render('I ({{cannot}}) be seen!', { cannot: null })).resolves.toBe('I () be seen!');
  });

  test('Dotted Names — Basic Interpolation (interpolation.json)', async () => {
    await expect(
      render('"{{person.name}}" == "{{#person}}{{name}}{{/person}}"', {
        person: { name: 'Joe' },
      }),
    ).resolves.toBe('"Joe" == "Joe"');
  });

  test('Implicit Iterators — Basic Interpolation (interpolation.json)', async () => {
    await expect(render('Hello, {{.}}!\n', 'world' as JsonValue)).resolves.toBe('Hello, world!\n');
  });

  test('Interpolation With Padding (interpolation.json)', async () => {
    await expect(render('|{{ string }}|', { string: '---' })).resolves.toBe('|---|');
  });
});

describe('mustache/spec — inverted', () => {
  test('Falsey (inverted.json)', async () => {
    await expect(
      render('"{{^boolean}}This should be rendered.{{/boolean}}"', { boolean: false }),
    ).resolves.toBe('"This should be rendered."');
  });

  test('Truthy (inverted.json)', async () => {
    await expect(
      render('"{{^boolean}}This should not be rendered.{{/boolean}}"', { boolean: true }),
    ).resolves.toBe('""');
  });
});

describe('mustache/spec — sections', () => {
  test('Truthy (sections.json)', async () => {
    await expect(
      render('"{{#boolean}}This should be rendered.{{/boolean}}"', { boolean: true }),
    ).resolves.toBe('"This should be rendered."');
  });

  test('Falsey (sections.json)', async () => {
    await expect(
      render('"{{#boolean}}This should not be rendered.{{/boolean}}"', { boolean: false }),
    ).resolves.toBe('""');
  });

  test('List (sections.json)', async () => {
    await expect(
      render('{{#items}}{{name}} {{/items}}', {
        items: [{ name: 'a' }, { name: 'b' }],
      }),
    ).resolves.toBe('a b ');
  });
});

describe('mustache/spec — partials (partials.json)', () => {
  test('WASM: `{{>name}}` fails at compile time (no host filesystem in wasm32)', async () => {
    await expect(render('{{>any_partial}}', {})).rejects.toThrow(/Failed to compile template/);
  });
});

describe('mustache/spec — optional extensions (not exercised via JSON / wasm-crustache)', () => {
  test.skip('~lambdas: callable lambdas are not representable in JSON (see ~lambdas.yml)', () => {});

  test.skip(
    '~dynamic-names: dynamic partial names are an optional extension (see ~dynamic-names.yml)',
    () => {},
  );

  test.skip(
    '~inheritance: parametric partials / blocks are an optional extension (see ~inheritance.yml)',
    () => {},
  );
});
