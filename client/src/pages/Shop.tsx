import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { money, apiError } from '../format';

interface Product {
  id: string;
  name: string;
  description: string;
  material: string;
  priceCents: number;
  tagsIncluded: number;
  icon: string;
}

interface Catalog {
  products: Product[];
  shippingCents: number;
  freeShippingOverCents: number;
  premiumDiscount: number;
}

interface Order {
  id: string;
  totalCents: number;
  status: string;
  createdAt: string;
  lines: { name: string; qty: number }[];
}

const CART_KEY = 'gs_cart';

function loadCart(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '{}'); } catch { return {}; }
}
function saveCart(cart: Record<string, number>) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* storage unavailable */ }
}

export default function Shop() {
  const { user, refreshUser } = useAuth();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [cart, setCart] = useState<Record<string, number>>(loadCart);
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [ship, setShip] = useState({ shipName: '', shipAddress: '' });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState<{ totalCents: number; pointsEarned: number } | null>(null);

  useEffect(() => {
    api.get('/api/shop/products').then(r => setCatalog(r.data));
  }, []);
  useEffect(() => {
    if (user) api.get('/api/shop/orders').then(r => setOrders(r.data)).catch(() => {});
  }, [user?.id]);
  useEffect(() => saveCart(cart), [cart]);

  const isPremium = user?.subscription === 'premium';

  const totals = useMemo(() => {
    if (!catalog) return null;
    const lines = catalog.products.filter(p => cart[p.id]).map(p => ({ product: p, qty: cart[p.id] }));
    const subtotal = lines.reduce((s, l) => s + l.product.priceCents * l.qty, 0);
    const discount = isPremium ? Math.round(subtotal * catalog.premiumDiscount) : 0;
    const shipping = subtotal - discount >= catalog.freeShippingOverCents || subtotal === 0 ? 0 : catalog.shippingCents;
    return { lines, subtotal, discount, shipping, total: subtotal - discount + shipping };
  }, [catalog, cart, isPremium]);

  function setQty(id: string, qty: number) {
    setCart(c => {
      const next = { ...c };
      if (qty <= 0) delete next[id]; else next[id] = Math.min(qty, 20);
      return next;
    });
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!totals) return;
    setError('');
    setPlacing(true);
    try {
      const { data } = await api.post('/api/shop/orders', {
        items: totals.lines.map(l => ({ productId: l.product.id, qty: l.qty })),
        ...ship
      });
      setPlaced({ totalCents: data.totalCents, pointsEarned: data.pointsEarned });
      setCart({});
      setCheckout(false);
      api.get('/api/shop/orders').then(r => setOrders(r.data));
      refreshUser();
    } catch (err) {
      setError(apiError(err, 'Could not place your order'));
    } finally {
      setPlacing(false);
    }
  }

  if (!catalog || !totals) return <div className="text-center py-20 text-gray-400">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 rounded-full px-3 py-1 text-xs font-medium mb-3">
          ♻️ Every tag is made from recycled or compostable materials
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Eco-friendly QR tags</h1>
        <p className="text-gray-500 mt-1">
          Durable tags printed with your items' QR codes. Free shipping over {money(catalog.freeShippingOverCents)}.
          {isPremium
            ? <span className="text-green-700 font-medium"> Your Premium {Math.round(catalog.premiumDiscount * 100)}% discount is applied.</span>
            : <> Premium members save {Math.round(catalog.premiumDiscount * 100)}%.</>}
        </p>
      </div>

      {placed && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">📦</span>
          <div>
            <p className="font-semibold text-green-800">Order placed: {money(placed.totalCents)}</p>
            <p className="text-sm text-green-700">
              You earned +{placed.pointsEarned} points. We'll print the QR codes of your registered items onto your tags.
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
          {catalog.products.map(p => (
            <div key={p.id} className="card p-5 flex flex-col">
              <div className="text-4xl mb-3">{p.icon}</div>
              <h3 className="font-semibold text-gray-900">{p.name}</h3>
              <p className="text-sm text-gray-500 mt-1 flex-1">{p.description}</p>
              <p className="text-xs text-green-700 mt-3">🌱 {p.material} · {p.tagsIncluded} tag{p.tagsIncluded > 1 ? 's' : ''}</p>
              <div className="flex items-center justify-between mt-4">
                <span className="text-lg font-bold text-gray-900">{money(p.priceCents)}</span>
                {cart[p.id] ? (
                  <div className="flex items-center gap-2">
                    <button className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-50" onClick={() => setQty(p.id, cart[p.id] - 1)} aria-label={`Remove one ${p.name}`}>−</button>
                    <span className="w-6 text-center font-medium">{cart[p.id]}</span>
                    <button className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-50" onClick={() => setQty(p.id, cart[p.id] + 1)} aria-label={`Add one ${p.name}`}>+</button>
                  </div>
                ) : (
                  <button className="btn-primary text-sm px-4 py-2" onClick={() => setQty(p.id, 1)}>Add to cart</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Cart */}
        <aside className="card p-5 h-fit lg:sticky lg:top-20">
          <h2 className="font-semibold text-gray-900 mb-4">Your cart</h2>
          {totals.lines.length === 0 ? (
            <p className="text-sm text-gray-400">Your cart is empty.</p>
          ) : (
            <>
              <ul className="space-y-2 text-sm mb-4">
                {totals.lines.map(l => (
                  <li key={l.product.id} className="flex justify-between gap-2">
                    <span className="text-gray-700">{l.qty} × {l.product.name}</span>
                    <span className="text-gray-900 font-medium">{money(l.product.priceCents * l.qty)}</span>
                  </li>
                ))}
              </ul>
              <dl className="border-t border-gray-100 pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-700"><dt>Premium discount</dt><dd>−{money(totals.discount)}</dd></div>
                )}
                <div className="flex justify-between"><dt className="text-gray-500">Shipping</dt><dd>{totals.shipping ? money(totals.shipping) : 'Free'}</dd></div>
                <div className="flex justify-between font-bold text-gray-900 pt-1"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
              </dl>

              {!user ? (
                <Link to="/login" className="btn-primary w-full block text-center mt-4">Sign in to check out</Link>
              ) : !checkout ? (
                <button className="btn-primary w-full mt-4" onClick={() => setCheckout(true)}>Checkout</button>
              ) : (
                <form onSubmit={placeOrder} className="mt-4 space-y-3">
                  {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
                  <input className="input-field" placeholder="Full name" value={ship.shipName}
                    onChange={e => setShip(s => ({ ...s, shipName: e.target.value }))} required />
                  <textarea className="input-field resize-none" rows={3} placeholder="Shipping address" value={ship.shipAddress}
                    onChange={e => setShip(s => ({ ...s, shipAddress: e.target.value }))} required />
                  <p className="text-xs text-gray-400">Demo checkout: no card is charged.</p>
                  <button className="btn-primary w-full" disabled={placing}>{placing ? 'Placing order…' : `Place order · ${money(totals.total)}`}</button>
                </form>
              )}
            </>
          )}
        </aside>
      </div>

      {orders.length > 0 && (
        <div className="card p-6 mt-8">
          <h2 className="font-semibold text-gray-900 mb-4">Your orders</h2>
          <ul className="divide-y divide-gray-100">
            {orders.map(o => (
              <li key={o.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="text-gray-800">{o.lines.map(l => `${l.qty} × ${l.name}`).join(', ')}</p>
                  <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString()} · #{o.id.slice(0, 8)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">{money(o.totalCents)}</p>
                  <span className="badge bg-blue-100 text-blue-700 capitalize">{o.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
