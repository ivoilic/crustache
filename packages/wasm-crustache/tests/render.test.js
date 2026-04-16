import { describe, expect, test } from 'vitest';
import { Template, render } from '../dist/index.mjs';
describe('wasm-crustache', () => {
    test('renders a simple variable', async () => {
        const output = await render('Hello {{name}}!', { name: 'Mercury' });
        expect(output).toBe('Hello Mercury!');
    });
    test('renders sections with arrays', async () => {
        const output = await render('{{#items}}{{name}} {{/items}}', {
            items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        });
        expect(output).toBe('A B C ');
    });
    test('renders inverted sections', async () => {
        const output = await render('{{^items}}No items{{/items}}', {
            items: [],
        });
        expect(output).toBe('No items');
    });
    test('supports nested dotted names', async () => {
        const output = await render('Welcome, {{user.profile.name}}', {
            user: { profile: { name: 'Ivo' } },
        });
        expect(output).toBe('Welcome, Ivo');
    });
    test('reuses compiled templates', async () => {
        const template = await Template.compile('Hi {{name}}');
        expect(template.render({ name: 'Earth' })).toBe('Hi Earth');
        expect(template.render({ name: 'Mars' })).toBe('Hi Mars');
    });
    test('throws an error for invalid templates', async () => {
        await expect(render('{{#broken}}', {})).rejects.toThrow('Failed to compile template');
    });
});
