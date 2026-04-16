import { Router, Request, Response } from 'express';
import { workflowService } from '../domain/workflow/workflow.service';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const orders = await workflowService.getAllOrders();
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { tableNumber, tableZone } = req.body as { tableNumber?: number; tableZone?: string };
    if (tableNumber === undefined || !tableZone) {
      res.status(400).json({ error: 'tableNumber and tableZone are required' });
      return;
    }

    await workflowService.sendToKitchen(tableNumber, tableZone);
    const workflow = await workflowService.getTableWorkflow(tableNumber, tableZone);
    res.json(workflow);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await workflowService.deleteOrder(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/:id/items/:itemId/move-to-preorder', async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const parsedItemId = Number(itemId);

    if (!Number.isInteger(parsedItemId)) {
      res.status(400).json({ error: 'Invalid item id' });
      return;
    }

    const targetTable = await workflowService.moveConfirmedOrderItemToPreOrder(id, parsedItemId);
    const workflow = await workflowService.getTableWorkflow(targetTable.tableNumber, targetTable.tableZone);
    res.json(workflow);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
