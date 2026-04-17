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

test('deleteOrder removes ticket children before parent rows', async () => {
  const calls: string[] = [];
  const repository = new WorkflowRepository({
    kitchenTicket: {
      findMany: async () => [{ id: 'ticket-a' }, { id: 'ticket-b' }],
      deleteMany: async () => {
        calls.push('kitchenTicket.deleteMany');
      },
    },
    kitchenTicketItem: {
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.push(`kitchenTicketItem.deleteMany:${JSON.stringify(where)}`);
      },
    },
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
    'kitchenTicketItem.deleteMany:{"ticketId":{"in":["ticket-a","ticket-b"]}}',
    'kitchenTicket.deleteMany',
    'payment.deleteMany',
    'orderItem.deleteMany',
    'order.delete',
  ]);
});
