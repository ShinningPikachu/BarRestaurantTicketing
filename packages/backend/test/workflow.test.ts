import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkflowRepository } from '../src/domain/workflow/workflow.repository.ts';
import { moveToPreorderParamSchema } from '../src/routes/orders.ts';

test('moveToPreorderParamSchema keeps both route params', () => {
  const parsed = moveToPreorderParamSchema.parse({ id: 'order-123', itemId: '4' });

  assert.deepEqual(parsed, { id: 'order-123', itemId: 4 });
});

test('createPreOrderItem omits nullish menuItemId values', async () => {
  const createdPayloads: Array<Record<string, unknown>> = [];
  const repository = new WorkflowRepository({
    preOrderItem: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdPayloads.push(data);
        return data;
      },
    },
  } as any);

  const missingMenuItem = await repository.createPreOrderItem('session-1', {
    name: 'Soup',
    qty: 2,
    unitPriceCents: 500,
  });

  const nullMenuItem = await repository.createPreOrderItem('session-1', {
    menuItemId: null,
    name: 'Soup',
    qty: 2,
    unitPriceCents: 500,
  });

  const linkedMenuItem = await repository.createPreOrderItem('session-1', {
    menuItemId: 8,
    name: 'Soup',
    qty: 2,
    unitPriceCents: 500,
  });

  assert.equal('menuItemId' in missingMenuItem, false);
  assert.equal('menuItemId' in nullMenuItem, false);
  assert.equal(linkedMenuItem.menuItemId, 8);
  assert.equal(createdPayloads.length, 3);
});

test('deleteOrder removes financial and item children before the parent row', async () => {
  const calls: string[] = [];
  const repository = new WorkflowRepository({
    payment: {
      deleteMany: async () => {
        calls.push('payment.deleteMany');
      },
    },
    orderItem: {
      deleteMany: async () => {
        calls.push('orderItem.deleteMany');
      },
    },
    order: {
      delete: async () => {
        calls.push('order.delete');
        return { id: 'order-1' };
      },
    },
  } as any);

  await repository.deleteOrder('order-1');

  assert.deepEqual(calls, [
    'payment.deleteMany',
    'orderItem.deleteMany',
    'order.delete',
  ]);
});

test('deleteTableWorkflowData removes table workflow rows before parent table', async () => {
  const calls: string[] = [];
  const repository = new WorkflowRepository({
    order: {
      findMany: async () => [{ id: 'order-a' }, { id: 'order-b' }],
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.push(`order.deleteMany:${JSON.stringify(where)}`);
      },
    },
    preOrderSession: {
      findMany: async () => [{ id: 'session-a' }],
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.push(`preOrderSession.deleteMany:${JSON.stringify(where)}`);
      },
    },
    payment: {
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.push(`payment.deleteMany:${JSON.stringify(where)}`);
      },
    },
    orderItem: {
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.push(`orderItem.deleteMany:${JSON.stringify(where)}`);
      },
    },
    preOrderItem: {
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.push(`preOrderItem.deleteMany:${JSON.stringify(where)}`);
      },
    },
  } as any);

  await repository.deleteTableWorkflowData(3);

  assert.deepEqual(calls, [
    'payment.deleteMany:{"orderId":{"in":["order-a","order-b"]}}',
    'orderItem.deleteMany:{"orderId":{"in":["order-a","order-b"]}}',
    'order.deleteMany:{"id":{"in":["order-a","order-b"]}}',
    'preOrderItem.deleteMany:{"sessionId":{"in":["session-a"]}}',
    'preOrderSession.deleteMany:{"id":{"in":["session-a"]}}',
  ]);
});
