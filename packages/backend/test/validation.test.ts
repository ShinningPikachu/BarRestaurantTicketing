import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../src/middleware/validation.ts';
import { ApiError } from '../src/middleware/errorHandler.ts';

function createRequest(partial: Record<string, unknown>) {
  return partial as any;
}

function createResponse() {
  return {} as any;
}

test('validateBody parses valid payloads', async () => {
  const req = createRequest({ body: { qty: '2', name: 'Burger' } });
  let nextCalled = false;

  await validateBody(z.object({ qty: z.coerce.number(), name: z.string() }))(req, createResponse(), (error?: unknown) => {
    assert.equal(error, undefined);
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.body, { qty: 2, name: 'Burger' });
});

test('validateBody returns ApiError for invalid payloads', async () => {
  const req = createRequest({ body: { qty: 'not-a-number' } });
  let capturedError: unknown;

  await validateBody(z.object({ qty: z.number() }))(req, createResponse(), (error?: unknown) => {
    capturedError = error;
  });

  assert.ok(capturedError instanceof ApiError);
  assert.equal((capturedError as ApiError).statusCode, 400);
  assert.equal((capturedError as ApiError).code, 'VALIDATION_ERROR');
});

test('validateParams parses route params with coercion', async () => {
  const req = createRequest({ params: { itemId: '12' } });

  await validateParams(z.object({ itemId: z.coerce.number().positive() }))(req, createResponse(), () => undefined);

  assert.deepEqual(req.params, { itemId: 12 });
});

test('validateQuery parses query params', async () => {
  const req = createRequest({ query: { page: '3' } });

  await validateQuery(z.object({ page: z.coerce.number().int().min(1) }))(req, createResponse(), () => undefined);

  assert.deepEqual(req.query, { page: 3 });
});
