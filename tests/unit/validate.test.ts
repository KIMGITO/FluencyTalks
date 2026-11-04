// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEmail, checkPassword, checkText, checkUsername, checkWholeNumber, cleanArgs, cleanText, firstProblem, limitLength } from '../../src/lib/validate.ts';
import { UserError, userMessage } from '../../src/lib/errors.ts';

test('cleanText removes what cannot be stored or read, and nothing a person wrote', () => {
  assert.equal(cleanText('  a\u0000b\u0007c  '), 'abc');
  assert.equal(cleanText('line one\r\nline two'), 'line one\nline two');
  assert.equal(cleanText('safe\u202Etxet'), 'safetxet');
  assert.equal(cleanText('half \uD83D emoji'), 'half  emoji');
  assert.equal(cleanText('👨‍👩‍👧 cười'), '👨‍👩‍👧 cười');
  assert.equal(cleanText('a\nb', { singleLine: true }), 'a b');
  assert.equal(cleanText(null), '');
});

test('text is never HTML-escaped: React and SQL parameters already handle that', () => {
  const nasty = `<script>alert(1)</script> Robert'); DROP TABLE students;-- "don't" & more`;
  assert.equal(cleanText(nasty), nasty);
});

test('Vietnamese typed as separate accents is stored as one form', () => {
  assert.equal(cleanText('Vie\u0323\u0302t'), 'Vi\u1EC7t');
});

test('limitLength cuts without leaving half an emoji', () => {
  assert.equal(limitLength('abcdef', 3), 'abc');
  assert.equal(limitLength('ab😀', 3), 'ab');
  assert.equal(limitLength('ab', 3), 'ab');
});

test('checkText', () => {
  assert.match(checkText('   ', { label: 'Phrase', required: true }), /can't be empty/);
  assert.equal(checkText('   ', { label: 'Note' }), '');
  assert.match(checkText('\u0000', { label: 'Phrase', required: true }), /can't be empty/);
  assert.match(checkText('abcd', { label: 'Name', max: 3 }), /at most 3/);
  assert.match(checkText('ab', { label: 'Name', min: 3 }), /at least 3/);
  assert.equal(checkText(' abc ', { label: 'Name', min: 3, max: 3 }), '');
});

test('checkEmail, checkPassword and checkUsername', () => {
  assert.equal(checkEmail(' me@example.com '), '');
  for (const bad of ['', 'me', 'me@', 'me@x', '@x.com', 'a b@x.com', `${'a'.repeat(250)}@x.com`]) assert.notEqual(checkEmail(bad), '', bad);
  assert.equal(checkPassword('12345678'), '');
  assert.match(checkPassword('1234567'), /at least 8/);
  assert.match(checkPassword('12345678901', 12), /at least 12/);
  assert.match(checkPassword('x'.repeat(73)), /at most 72/);
  assert.notEqual(checkPassword(''), '');
  assert.equal(checkUsername('dennis_2'), '');
  for (const bad of ['ab', 'Has Caps', 'a'.repeat(21), 'semi;colon']) assert.notEqual(checkUsername(bad), '', bad);
});

test('checkWholeNumber refuses what Number() would let through', () => {
  assert.equal(checkWholeNumber('24', { label: 'Hours' }), '');
  assert.equal(checkWholeNumber('0', { label: 'Hours' }), '');
  for (const bad of ['', ' ', '1e3', '2.5', '-1', 'abc', 'Infinity', '0x10']) assert.notEqual(checkWholeNumber(bad, { label: 'Hours' }), '', bad);
  assert.match(checkWholeNumber('99', { label: 'Hours', max: 10 }), /between 0 and 10/);
});

test('firstProblem', () => {
  assert.equal(firstProblem('', 'b', 'c'), 'b');
  assert.equal(firstProblem('', ''), '');
});

test('cleanArgs cleans strings at any depth and leaves everything else alone', () => {
  const out = cleanArgs({ p_text: 'a\u0000b', p_n: 3, p_on: false, p_none: null, p_json: { list: ['x\u0000', { y: 'z\uD83D' }] } });
  assert.deepEqual(out, { p_text: 'ab', p_n: 3, p_on: false, p_none: null, p_json: { list: ['x', { y: 'z' }] } });
  assert.equal(cleanArgs('  keeps its spaces\n'), '  keeps its spaces\n');
  assert.equal(cleanArgs(undefined), undefined);
});

test('cleanArgs refuses numbers JSON would turn into null', () => {
  assert.throws(() => cleanArgs({ p: NaN }), RangeError);
  assert.throws(() => cleanArgs({ p: [Infinity] }), RangeError);
});

test('only UserError reaches the screen', () => {
  assert.equal(userMessage(new UserError('Choose a category.')), 'Choose a category.');
  assert.equal(userMessage(new Error('relation "profiles" does not exist')), 'Oops! Something went wrong. Please try again.');
  assert.equal(userMessage({ message: 'permission denied for table x', code: '42501' }), 'Oops! Something went wrong. Please try again.');
  assert.equal(userMessage(new TypeError('Failed to fetch'), 'Could not load.'), 'Could not load.');
  assert.equal(userMessage(undefined), 'Oops! Something went wrong. Please try again.');
});
