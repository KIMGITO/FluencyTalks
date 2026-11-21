// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callPhase, deviceErrorText, endedText, formatDuration, type CallInfo, type CallParticipant } from '../../src/lib/callState.ts';

const A = 'a', B = 'b';
const person = (user_id: string, o: Partial<CallParticipant> = {}): CallParticipant => ({
  user_id, username: user_id, display_name: user_id.toUpperCase(), avatar_url: null, role: user_id === A ? 'host' : 'participant',
  invitation_status: user_id === A ? 'accepted' : 'pending', presence: 'invited', joined_at: null, left_at: null, ...o,
});
const call = (o: Partial<CallInfo> = {}, b: Partial<CallParticipant> = {}): CallInfo => ({
  id: 'c', status: 'ringing', host_id: A, initiated_by: A, created_at: '2026-11-21T10:00:00Z', ring_expires_at: '2026-11-21T10:00:45Z',
  started_at: null, ended_at: null, end_reason: null, max_participants: 2, participants: [person(A), person(B, b)], ...o,
});

test('the caller: preview, then ringing until someone joins, then active', () => {
  assert.equal(callPhase(null, A, 'idle', 0), 'loading');
  assert.equal(callPhase(call(), A, 'idle', 0), 'preview');
  assert.equal(callPhase(call(), A, 'connecting', 0), 'connecting');
  assert.equal(callPhase(call(), A, 'connected', 0), 'ringing');
  assert.equal(callPhase(call({ status: 'active' }, { invitation_status: 'accepted' }), A, 'connected', 0), 'waiting');
  assert.equal(callPhase(call({ status: 'active' }, { invitation_status: 'accepted' }), A, 'connected', 1), 'active');
});

test('the callee: incoming until they answer; trouble shows as reconnecting or failed', () => {
  assert.equal(callPhase(call(), B, 'idle', 0), 'incoming');
  const answered = call({ status: 'active' }, { invitation_status: 'accepted' });
  assert.equal(callPhase(answered, B, 'idle', 0), 'preview', 'after a refresh: rejoin');
  assert.equal(callPhase(answered, B, 'reconnecting', 1), 'reconnecting');
  assert.equal(callPhase(answered, B, 'failed', 0), 'failed');
});

test('over, declined, removed or not mine: ended', () => {
  assert.equal(callPhase(call({ status: 'ended' }), A, 'connected', 1), 'ended');
  assert.equal(callPhase(call({}, { invitation_status: 'declined' }), B, 'idle', 0), 'ended');
  assert.equal(callPhase(call({ status: 'active' }, { invitation_status: 'accepted', presence: 'removed' }), B, 'idle', 0), 'ended');
  assert.equal(callPhase(call(), 'stranger', 'idle', 0), 'ended');
});

test('the ended screen says what happened, from each side', () => {
  const ended = (end_reason: string, extra: Partial<CallInfo> = {}) => call({ status: 'ended', end_reason, ...extra });
  assert.equal(endedText(ended('no_answer'), A, 'Linh').title, 'No answer');
  assert.equal(endedText(ended('no_answer'), B).title, 'Missed call');
  assert.equal(endedText(ended('cancelled'), B).title, 'Missed call');
  assert.equal(endedText(ended('declined'), A, 'Linh').detail, "Linh can't talk right now.");
  assert.equal(endedText(ended('hung_up', { started_at: '2026-11-21T10:00:00Z', ended_at: '2026-11-21T10:03:05Z' }), A).detail, 'It lasted 3:05.');
});

test('durations and device errors read well', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.match(deviceErrorText({ name: 'NotAllowedError' }, 'camera'), /blocked the camera/);
  assert.match(deviceErrorText({ name: 'NotFoundError' }, 'microphone'), /No microphone/);
  assert.match(deviceErrorText({ name: 'NotReadableError' }, 'camera'), /another app/);
  assert.match(deviceErrorText(new Error('x'), 'camera'), /couldn't start/);
});

import { notificationLink, notificationVerb } from '../../supabase/functions/_shared/notification-text.ts';
test('call notifications read well and open the call', () => {
  const n = (type: string) => ({ type, actor_username: 'linh', data: { call_id: 'c1' } });
  assert.equal(notificationVerb(n('call_incoming')), 'is calling you');
  assert.equal(notificationVerb(n('call_missed')), 'tried to call you');
  assert.equal(notificationLink(n('call_incoming')), '/call/c1');
  assert.equal(notificationLink(n('call_missed')), '/call/c1');
});
