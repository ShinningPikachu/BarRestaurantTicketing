import assert from 'node:assert/strict';
import test from 'node:test';
import { getSessionWindow } from '../src/routes/tickets.ts';

test('session windows include every early-morning sale', () => {
  const reference = new Date(2026, 6, 18, 4, 30, 0, 0);
  const { start, end } = getSessionWindow(reference);

  assert.equal(start.getHours(), 6);
  assert.equal(end.getHours(), 6);
  assert.ok(start <= reference);
  assert.ok(reference < end);
  assert.equal(start.getDate(), 17);
  assert.equal(end.getDate(), 18);
});

test('spring daylight-saving transition preserves the 06:00 local session boundary', () => {
  const reference = new Date('2026-03-28T11:00:00Z');
  const { start, end } = getSessionWindow(reference);
  assert.equal(start.toISOString(), '2026-03-28T05:00:00.000Z');
  assert.equal(end.toISOString(), '2026-03-29T04:00:00.000Z');
  assert.equal((end.getTime() - start.getTime()) / 3_600_000, 23);
});

test('autumn daylight-saving transition preserves the 06:00 local session boundary', () => {
  const reference = new Date('2026-10-24T11:00:00Z');
  const { start, end } = getSessionWindow(reference);
  assert.equal(start.toISOString(), '2026-10-24T04:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-25T05:00:00.000Z');
  assert.equal((end.getTime() - start.getTime()) / 3_600_000, 25);
});
