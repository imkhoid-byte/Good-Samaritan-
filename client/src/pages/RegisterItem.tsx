import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const CATEGORIES = [
  { value: 'keys', label: 'Keys', icon: '🔑' },
  { value: 'wallet', label: 'Wallet', icon: '👜' },
  { value: 'bag', label: 'Bag / Backpack', icon: '🎒' },
  { value: 'phone', label: 'Phone', icon: '📱' },
  { value: 'laptop', label: 'Laptop / Tablet', icon: '💻' },
  { value: 'jewelry', label: 'Jewelry', icon: '💍' },
  { value: 'glasses', label: 'Glasses', icon: '👓' },
  { value: 'pet', label: 'Pet Tag', icon: '🐾' },
  { value: 'other', label: 'Other', icon: '📦' }
];

export default function RegisterItem() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', description: '', category: 'other',
    rewardOffered: 0, rewardNote: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Item name is required'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/api/items', form);
      navigate(`/items/${data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to register item. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Register an Item</h1>
        <p className="text-gray-500 mt-1">
          Add your item details and we'll generate a unique QR code to attach to it.
        </p>
      </div>

      <div className="card p-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => set('category', cat.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center ${
                    form.category === cat.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-xs text-gray-600 leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. My House Keys, Blue Backpack"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder="Add any identifying details — colour, brand, distinguishing marks…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* Reward */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <label className="block text-sm font-semibold text-amber-900 mb-3">
              🏆 Reward (optional)
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-amber-700 mb-1">Reward amount ($)</label>
                <input
                  type="number"
                  min="0"
                  max="9999"
                  className="input-field"
                  placeholder="0"
                  value={form.rewardOffered || ''}
                  onChange={e => set('rewardOffered', parseInt(e.target.value) || 0)}
                />
              </div>
              {form.rewardOffered > 0 && (
                <div>
                  <label className="block text-xs text-amber-700 mb-1">Reward note</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Reward paid upon return"
                    value={form.rewardNote}
                    onChange={e => set('rewardNote', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Generating QR…' : 'Generate QR Code'}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
        <span className="text-green-600 text-lg">✓</span>
        <p className="text-sm text-green-800">
          Registering an item earns you <strong>+10 Good Samaritan points</strong>.
          Privacy protected — your personal contact info is never shared with finders.
        </p>
      </div>
    </div>
  );
}
