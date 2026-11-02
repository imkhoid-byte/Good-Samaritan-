import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { PRODUCTS, SHIPPING_CENTS, FREE_SHIPPING_OVER_CENTS, PREMIUM_DISCOUNT } from '../catalog';

const router = Router();
const ORDER_POINTS = 20;

router.get('/products', (_req, res) => {
  res.json({
    products: PRODUCTS,
    shippingCents: SHIPPING_CENTS,
    freeShippingOverCents: FREE_SHIPPING_OVER_CENTS,
    premiumDiscount: PREMIUM_DISCOUNT
  });
});

interface LineInput { productId: string; qty: number }

router.post('/orders', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { items, shipName, shipAddress } = req.body as { items?: LineInput[]; shipName?: string; shipAddress?: string };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Your cart is empty' }); return;
  }
  if (!shipName?.trim() || !shipAddress?.trim()) {
    res.status(400).json({ error: 'Shipping name and address are required' }); return;
  }

  // Prices are always computed server-side from the catalog.
  const lines = [];
  for (const line of items) {
    const product = PRODUCTS.find(p => p.id === line.productId);
    const qty = Math.floor(Number(line.qty));
    if (!product || !Number.isFinite(qty) || qty < 1 || qty > 20) {
      res.status(400).json({ error: 'Invalid item in cart' }); return;
    }
    lines.push({ productId: product.id, name: product.name, qty, unitCents: product.priceCents });
  }

  const db = getDb();
  const userRes = await db.execute({ sql: 'SELECT subscription FROM users WHERE id = ?', args: [req.userId!] });
  const isPremium = (userRes.rows[0] as any)?.subscription === 'premium';

  const subtotal = lines.reduce((s, l) => s + l.unitCents * l.qty, 0);
  const discount = isPremium ? Math.round(subtotal * PREMIUM_DISCOUNT) : 0;
  const afterDiscount = subtotal - discount;
  const shipping = afterDiscount >= FREE_SHIPPING_OVER_CENTS ? 0 : SHIPPING_CENTS;
  const total = afterDiscount + shipping;

  const id = uuidv4();
  const summary = { lines, subtotalCents: subtotal, discountCents: discount, shippingCents: shipping };
  await db.batch([
    {
      sql: 'INSERT INTO orders (id, user_id, items_json, total_cents, ship_name, ship_address) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, req.userId!, JSON.stringify(summary), total, shipName.trim(), shipAddress.trim()]
    },
    {
      sql: 'INSERT INTO reward_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, ?)',
      args: [uuidv4(), req.userId!, ORDER_POINTS, 'Ordered eco-friendly QR tags']
    },
    { sql: 'UPDATE users SET points = points + ? WHERE id = ?', args: [ORDER_POINTS, req.userId!] }
  ], 'write');

  res.status(201).json({ id, totalCents: total, ...summary, status: 'placed', pointsEarned: ORDER_POINTS });
});

router.get('/orders', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    args: [req.userId!]
  });
  res.json(result.rows.map((o: any) => ({
    id: o.id,
    totalCents: Number(o.total_cents),
    status: o.status,
    shipName: o.ship_name,
    createdAt: o.created_at,
    ...JSON.parse(o.items_json)
  })));
});

export default router;
