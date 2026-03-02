import express from 'express';
import cors from 'cors';
import prisma from './db';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: String(e) });
  }
});

app.get('/api/orders', async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({ include: { items: true } });
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { table, items } = req.body;
    const created = await prisma.order.create({
      data: {
        table: { connectOrCreate: { where: { number: table }, create: { number: table } } },
        items: { create: items.map((it: any) => ({ name: it.name, qty: it.qty, unitPriceCents: it.unitPriceCents || 0, totalPriceCents: (it.unitPriceCents || 0) * (it.qty || 1) })) }
      },
      include: { items: true }
    });
    res.json(created);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    await prisma.order.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Menu items endpoints
app.get('/api/menu', async (_req, res) => {
  try {
    const items = await prisma.menuItem.findMany({ where: { available: true } });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/menu/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.menuItem.findUnique({ where: { id: parseInt(id) } });
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/menu/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const items = await prisma.menuItem.findMany({ where: { category, available: true } });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});
