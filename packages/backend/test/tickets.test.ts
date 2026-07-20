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
