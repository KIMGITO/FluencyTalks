// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composerLanguages, languageTabLabel, pickComposerLanguage } from '../../src/lib/composerLanguages.ts';

test('the language being learned comes first, so it is the default', () => {
  assert.deepEqual(composerLanguages({ native_language_id: 'swh', learning_language_id: 'vie' }), ['vie', 'swh']);
  assert.equal(pickComposerLanguage(['vie', 'swh'], null), 'vie');
});

test('one relevant language: a single option, no switching', () => {
  assert.deepEqual(composerLanguages({ native_language_id: 'swh', learning_language_id: null }), ['swh']);
  assert.deepEqual(composerLanguages({ native_language_id: 'swh', learning_language_id: 'swh' }), ['swh']);
});

test('no profile yet: nothing to offer, and the server picks', () => {
  assert.deepEqual(composerLanguages(null), []);
  assert.equal(pickComposerLanguage([], 'vie'), '');
});

test('switching keeps the choice; a language that is no longer mine falls back to the default', () => {
  assert.equal(pickComposerLanguage(['vie', 'swh'], 'swh'), 'swh');
  assert.equal(pickComposerLanguage(['eng', 'swh'], 'vie'), 'eng');
});

test('tabs show the ISO code in capitals', () => {
  assert.equal(languageTabLabel('swh'), 'SWH');
  assert.equal(languageTabLabel('eng'), 'ENG');
});
