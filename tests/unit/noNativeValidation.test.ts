// npm run test:unit
// The app checks input in code (lib/validate), so a browser bubble like "Please fill out this field" can never appear.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const path = join(dir, e.name);
  return e.isDirectory() ? sources(path) : /\.(tsx|jsx)$/.test(e.name) ? [path] : [];
});
const files = sources('src').map((path) => ({ path, text: readFileSync(path, 'utf8') }));
/** Every opening tag of a field, attributes included. */
const tags = (text: string, name: string) => [...text.matchAll(new RegExp(`<${name}\\b(?:[^>"'{]|"[^"]*"|'[^']*'|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*>`, 'g'))].map((m) => m[0]);

test('every form turns off the browser validation', () => {
  for (const { path, text } of files) for (const form of tags(text, 'form')) assert.match(form, /\bnoValidate\b/, `${path}: ${form.slice(0, 60)}`);
});

test('no field uses a validation attribute', () => {
  for (const { path, text } of files) {
    for (const field of ['input', 'textarea', 'select', 'Input', 'Textarea']) {
      for (const tag of tags(text, field)) {
        assert.doesNotMatch(tag, /\s(required|minLength|min|max|pattern)(=|\s|\/?>)/, `${path}: ${tag.slice(0, 80)}`);
        if (/^<[a-z]/.test(tag)) assert.doesNotMatch(tag, /\smaxLength=/, `${path}: ${tag.slice(0, 80)}`);
        if (/^<[a-z]/.test(tag)) assert.doesNotMatch(tag, /\stype="(email|url|number|tel)"/, `${path}: ${tag.slice(0, 80)}`);
      }
    }
  }
});
