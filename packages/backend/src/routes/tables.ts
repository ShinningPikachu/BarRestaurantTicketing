import { Request, Response, Router } from 'express';
import { workflowService } from '../domain/workflow/workflow.service';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const tables = await workflowService.listTables();
    res.json(tables);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { zone } = req.body as { zone?: string };
    if (!zone) {
      res.status(400).json({ error: 'zone is required' });
      return;
    }

    const table = await workflowService.addTable(zone);
    res.json(table);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:zone/:number/workflow', async (req: Request, res: Response) => {
  try {
    const zone = req.params.zone;
    const number = Number(req.params.number);

    if (!Number.isInteger(number)) {
      res.status(400).json({ error: 'invalid table number' });
      return;
    }

    const workflow = await workflowService.getTableWorkflow(number, zone);
    res.json(workflow);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/:zone/:number/preorder/items', async (req: Request, res: Response) => {
  try {
    const zone = req.params.zone;
    const number = Number(req.params.number);
    const { menuItemId } = req.body as { menuItemId?: number };

    if (!Number.isInteger(number) || menuItemId === undefined || !Number.isInteger(menuItemId)) {
      res.status(400).json({ error: 'invalid payload' });
      return;
    }

    await workflowService.addPreOrderMenuItem(number, zone, menuItemId);
    const workflow = await workflowService.getTableWorkflow(number, zone);
    res.json(workflow);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch('/:zone/:number/preorder/items/:itemId', async (req: Request, res: Response) => {
  try {
    const zone = req.params.zone;
    const number = Number(req.params.number);
    const itemId = Number(req.params.itemId);
    const { qty, unitPriceCents } = req.body as { qty?: number; unitPriceCents?: number };

    if (!Number.isInteger(number) || !Number.isInteger(itemId)) {
      res.status(400).json({ error: 'invalid path params' });
      return;
    }

    if (qty !== undefined && (!Number.isInteger(qty) || qty < 0)) {
      res.status(400).json({ error: 'qty must be an integer >= 0' });
      return;
    }

    if (unitPriceCents !== undefined && (!Number.isInteger(unitPriceCents) || unitPriceCents < 0)) {
      res.status(400).json({ error: 'unitPriceCents must be an integer >= 0' });
      return;
    }

    await workflowService.updatePreOrderItem(number, zone, itemId, { qty, unitPriceCents });
    const workflow = await workflowService.getTableWorkflow(number, zone);
    res.json(workflow);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/:zone/:number/preorder/clear', async (req: Request, res: Response) => {
  try {
    const zone = req.params.zone;
    const number = Number(req.params.number);
    if (!Number.isInteger(number)) {
      res.status(400).json({ error: 'invalid table number' });
      return;
    }

    await workflowService.clearPreOrder(number, zone);
    const workflow = await workflowService.getTableWorkflow(number, zone);
    res.json(workflow);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/:zone/:number/send-to-kitchen', async (req: Request, res: Response) => {
  try {
    const zone = req.params.zone;
    const number = Number(req.params.number);
    if (!Number.isInteger(number)) {
      res.status(400).json({ error: 'invalid table number' });
      return;
    }

    await workflowService.sendToKitchen(number, zone);
    const workflow = await workflowService.getTableWorkflow(number, zone);
    res.json(workflow);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
