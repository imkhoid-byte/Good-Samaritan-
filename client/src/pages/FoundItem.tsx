import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

interface PublicItem {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  rewardOffered: number;
  rewardNote: string;
  ownerName: string | null;
}

interface Charity { id: string; name: string; icon: string; cause: string }

const CATEGORY_ICONS: Record<string, string> = {
  keys: '🔑', wallet: '👜', bag: '🎒', phone: '📱',
  laptop: '💻', jewelry: '💍', glasses: '👓', pet: '🐾',
  other: '📦'
};

export default function FoundItem() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<PublicItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({ senderName: '', senderEmail: '', content: '', charityId: '' });
  const [charities, setCharities] = useState<Charity[]>([]);
  const [donation, setDonation] = useState<{ cents: number; charity: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchItem();
    api.get('/api/community/charities').then(r => setCharities(r.data.charities)).catch(() => {});
  }, [id]);

  async function fetchItem() {
    try {
      const { data } = await api.get(`/api/items/public/${id}`);
      setItem(data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const { data } = await api.post(`/api/messages/found/${id}`, { ...form, charityId: form.charityId || undefined });
      setDonation(data.donation);
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Item Not Found</h1>
          <p className="text-gray-500 mb-6">This QR code doesn't match any registered item.</p>
          <Link to="/" className="btn-primary">Visit Good Samaritan</Link>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const isInactive = item.status === 'returned' || item.status === 'inactive';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-white font-bold">GS</div>
            <span className="font-bold text-gray-900">Good Samaritan</span>
          </Link>
          <div className="text-5xl mb-3">{CATEGORY_ICONS[item.category] || '📦'}</div>
          <h1 className="text-2xl font-bold text-gray-900">You found something!</h1>
          <p className="text-gray-500 mt-1">Be a Good Samaritan and help return it.</p>
        </div>

        {/* Item card */}
        <div className="card p-6 mb-4">
          <div className="flex items-start gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{item.name}</h2>
              {item.description && (
                <p className="text-gray-600 text-sm mt-1">{item.description}</p>
              )}
              <p className="text-sm text-gray-400 mt-2">
                Registered by <strong className="text-gray-600">{item.ownerName || 'a Good Samaritan member'}</strong>
              </p>
            </div>
          </div>
          {item.rewardOffered > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
              <span className="text-amber-500 text-lg">🏆</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">${item.rewardOffered} Reward Offered</p>
                {item.rewardNote && <p className="text-xs text-amber-600">{item.rewardNote}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Message form */}
        {isInactive ? (
          <div className="card p-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="font-semibold text-gray-900">This item has been returned</p>
            <p className="text-sm text-gray-500 mt-1">No further action is needed. Thank you!</p>
          </div>
        ) : sent ? (
          <div className="card p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Message Sent!</h3>
            <p className="text-gray-600 text-sm">
              The owner has been notified. They'll reach out to arrange a return.
              Thank you for being a Good Samaritan!
            </p>
            <div className="mt-5 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-700">
                {donation
                  ? `💚 To thank you, we donated $${(donation.cents / 100).toFixed(2)} to ${donation.charity}.`
                  : '💚 Your act of kindness contributes to a more trustworthy community.'}
              </p>
            </div>
            <Link to="/community" className="block mt-5 text-sm text-green-600 hover:underline">
              See what the community has done together →
            </Link>
            <Link to="/" className="block mt-5 text-sm text-green-600 hover:underline">
              Learn about Good Samaritan →
            </Link>
          </div>
        ) : (
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Contact the Owner</h3>
            <p className="text-sm text-gray-500 mb-5">
              Your contact details will only be visible to the item's owner and will not be shared publicly.
            </p>
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Jane Smith"
                  value={form.senderName}
                  onChange={e => setForm(f => ({ ...f, senderName: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="you@example.com"
                  value={form.senderEmail}
                  onChange={e => setForm(f => ({ ...f, senderEmail: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Hi! I found your item and I'd like to return it. I'm currently in [location]…"
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  required
                />
              </div>
              {charities.length > 0 && (
                <fieldset>
                  <legend className="block text-sm font-medium text-gray-700 mb-1.5">
                    Pick a charity: we'll donate $1 on your behalf 💚
                  </legend>
                  <div className="grid grid-cols-5 gap-2">
                    {charities.map(c => (
                      <button
                        type="button"
                        key={c.id}
                        title={`${c.name}: ${c.cause}`}
                        aria-pressed={form.charityId === c.id}
                        onClick={() => setForm(f => ({ ...f, charityId: f.charityId === c.id ? '' : c.id }))}
                        className={`text-2xl rounded-lg py-2 border transition-colors ${
                          form.charityId === c.id ? 'border-green-500 bg-green-50 ring-2 ring-green-500' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {c.icon}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 h-4">
                    {charities.find(c => c.id === form.charityId)?.name || 'Optional'}
                  </p>
                </fieldset>
              )}
              <button type="submit" className="btn-primary w-full" disabled={sending}>
                {sending ? 'Sending…' : '💌 Send Message to Owner'}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by{' '}
          <Link to="/" className="text-green-600 hover:underline">Good Samaritan</Link>
          {' '}· Privacy protected
        </p>
      </div>
    </div>
  );
}
