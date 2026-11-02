import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { money, apiError } from '../format';

interface PremiumState {
  subscription: string;
  premiumSince: string | null;
  anonymousMode: boolean;
  priceCents: number;
}

interface Tip { category: string; title: string; body: string }
interface Tips { isPremium: boolean; general: Tip[]; personal: Tip[]; lockedCount: number }

const PERKS = [
  { icon: '🔔', title: 'Instant found alerts', text: 'Get an email the moment a finder messages you, instead of waiting until you next check your dashboard.' },
  { icon: '🕶️', title: 'Anonymous mode', text: 'Hide your name on scan pages and community stories.' },
  { icon: '🧭', title: 'Personal loss-prevention tips', text: 'Advice matched to the kinds of items you have registered.' },
  { icon: '🏷️', title: '15% off tags', text: 'Discount on every eco-friendly tag in the shop.' }
];

export default function Premium() {
  const { refreshUser } = useAuth();
  const [state, setState] = useState<PremiumState | null>(null);
  const [tips, setTips] = useState<Tips | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [p, t] = await Promise.all([api.get('/api/account/premium'), api.get('/api/account/tips')]);
    setState(p.data);
    setTips(t.data);
  }
  useEffect(() => { load(); }, []);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await Promise.all([load(), refreshUser()]);
    } catch (err) {
      setError(apiError(err, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  }

  if (!state || !tips) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  const isPremium = state.subscription === 'premium';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Good Samaritan Premium</h1>
        <p className="text-gray-500 mt-1">
          {isPremium
            ? `You're a Premium member${state.premiumSince ? ` since ${new Date(state.premiumSince).toLocaleDateString()}` : ''}. Thank you for supporting the community.`
            : 'Faster alerts, more privacy and smarter protection for your belongings.'}
        </p>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="grid md:grid-cols-2 gap-5 mb-8">
        <div className={`card p-6 ${isPremium ? 'border-2 border-green-300' : ''}`}>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-lg">Premium</h2>
            <span className="text-2xl font-extrabold text-green-600">{money(state.priceCents)}<span className="text-sm font-medium text-gray-400">/mo</span></span>
          </div>
          <ul className="space-y-3 mb-6">
            {PERKS.map(p => (
              <li key={p.title} className="flex gap-3">
                <span className="text-xl">{p.icon}</span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{p.title}</span>
                  <span className="block text-xs text-gray-500">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
          {isPremium ? (
            <button className="btn-secondary w-full" disabled={busy} onClick={() => run(() => api.delete('/api/account/premium'))}>
              Cancel Premium
            </button>
          ) : (
            <>
              <button className="btn-primary w-full" disabled={busy} onClick={() => run(() => api.post('/api/account/premium'))}>
                {busy ? 'Upgrading…' : 'Upgrade to Premium'}
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">Demo billing: no card is charged.</p>
            </>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-gray-900 text-lg mb-4">Privacy</h2>
          <label className={`flex items-start gap-3 ${isPremium ? 'cursor-pointer' : 'opacity-60'}`}>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-green-600"
              checked={state.anonymousMode}
              disabled={!isPremium || busy}
              onChange={e => {
                const on = e.target.checked;
                setState(s => (s ? { ...s, anonymousMode: on } : s));
                run(() => api.patch('/api/account/settings', { anonymousMode: on }));
              }}
            />
            <span>
              <span className="block text-sm font-semibold text-gray-900">Anonymous mode</span>
              <span className="block text-xs text-gray-500">
                Finders who scan your tags see "a Good Samaritan member" instead of your first name. Your stories are posted anonymously.
                {!isPremium && ' Premium only.'}
              </span>
            </span>
          </label>
          <div className="mt-6 bg-gray-50 rounded-lg p-4 text-xs text-gray-500 space-y-1">
            <p>🔒 Your email and phone are never shown to finders.</p>
            <p>💬 Finders reach you through the app; you choose whether to reply.</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-bold text-gray-900 text-lg mb-1">Loss-prevention tips</h2>
        <p className="text-sm text-gray-500 mb-5">Small habits that keep your things with you.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[...tips.personal, ...tips.general].map(t => (
            <div key={t.title} className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-green-700 font-semibold mb-1">{t.category === 'general' ? 'Everyday' : `For your ${t.category}`}</p>
              <p className="text-sm font-semibold text-gray-900">{t.title}</p>
              <p className="text-xs text-gray-600 mt-1">{t.body}</p>
            </div>
          ))}
        </div>
        {tips.lockedCount > 0 && (
          <p className="mt-4 text-sm text-gray-500">
            🔒 {tips.lockedCount} more tip{tips.lockedCount > 1 ? 's' : ''} matched to your items {tips.lockedCount > 1 ? 'are' : 'is'} available with Premium.
          </p>
        )}
      </div>
    </div>
  );
}
