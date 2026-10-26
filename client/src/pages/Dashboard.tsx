import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { TAG_STATUS } from '../venue';

interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  rewardOffered: number;
  createdAt: string;
  unreadCount: number;
}

interface VenueTag {
  code: string;
  status: string;
  label: string | null;
  venueName: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  lost: { label: 'Lost', color: 'bg-red-100 text-red-700' },
  returned: { label: 'Returned', color: 'bg-blue-100 text-blue-700' },
  inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-500' }
};

const CATEGORY_ICONS: Record<string, string> = {
  keys: '🔑', wallet: '👜', bag: '🎒', phone: '📱',
  laptop: '💻', jewelry: '💍', glasses: '👓', pet: '🐾',
  other: '📦'
};

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [venueTags, setVenueTags] = useState<VenueTag[]>([]);

  useEffect(() => {
    fetchItems();
    refreshUser();
    api.get('/api/tags/mine').then(({ data }) => setVenueTags(data)).catch(() => {});
  }, []);

  async function fetchItems() {
    try {
      const { data } = await api.get('/api/items');
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(itemId: string, status: string) {
    await api.patch(`/api/items/${itemId}/status`, { status });
    await Promise.all([fetchItems(), refreshUser()]);
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    await api.delete(`/api/items/${itemId}`);
    await fetchItems();
  }

  const activeItems = items.filter(i => i.status === 'active' || i.status === 'lost');
  const returnedItems = items.filter(i => i.status === 'returned');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-gray-500 mt-1">Manage your registered items and QR tags.</p>
        </div>
        <Link to="/items/new" className="btn-primary">
          + Register Item
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Items Registered', value: items.length, icon: '📦' },
          { label: 'Active Tags', value: activeItems.length, icon: '✅' },
          { label: 'Items Returned', value: returnedItems.length, icon: '🎉' },
          { label: 'Points Earned', value: user?.points || 0, icon: '⭐' }
        ].map(s => (
          <div key={s.label} className="card p-5">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Unread messages banner */}
      {user?.unreadMessages ? (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">📬</span>
          <div>
            <p className="font-semibold text-amber-800">
              You have {user.unreadMessages} unread message{user.unreadMessages > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-amber-700">Someone may have found one of your items!</p>
          </div>
        </div>
      ) : null}

      {/* Venue tags claimed while signed in (coat check, events…) */}
      {venueTags.filter(t => t.status !== 'returned').length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Checked in at venues</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {venueTags.filter(t => t.status !== 'returned').map(t => (
              <Link key={t.code} to={`/t/${t.code}`} className="card p-4 flex items-center justify-between gap-3 hover:shadow-md transition-shadow">
                <span className="min-w-0">
                  <span className="block font-medium text-gray-900 truncate">{t.label || 'Tagged item'}</span>
                  <span className="block text-xs text-gray-500 truncate">{t.venueName}</span>
                </span>
                <span className={`badge shrink-0 ${TAG_STATUS[t.status]?.color}`}>{TAG_STATUS[t.status]?.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Items list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading your items…</div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">📦</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No items yet</h3>
          <p className="text-gray-500 mb-6">Register your first item to generate a QR code tag.</p>
          <Link to="/items/new" className="btn-primary">Register Your First Item</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center text-2xl shrink-0">
                  {CATEGORY_ICONS[item.category] || '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.unreadCount > 0 && (
                        <span className="badge bg-red-100 text-red-700">
                          {item.unreadCount} new
                        </span>
                      )}
                      <span className={`badge ${STATUS_CONFIG[item.status]?.color}`}>
                        {STATUS_CONFIG[item.status]?.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <Link
                      to={`/items/${item.id}`}
                      className="text-sm text-green-600 font-medium hover:underline"
                    >
                      View QR & Messages
                    </Link>
                    {item.status !== 'returned' && (
                      <>
                        {item.status !== 'lost' ? (
                          <button
                            onClick={() => updateStatus(item.id, 'lost')}
                            className="text-sm text-red-500 hover:underline"
                          >
                            Mark as Lost
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStatus(item.id, 'active')}
                            className="text-sm text-green-600 hover:underline"
                          >
                            Mark as Found
                          </button>
                        )}
                        <button
                          onClick={() => updateStatus(item.id, 'returned')}
                          className="text-sm text-blue-500 hover:underline"
                        >
                          Mark Returned
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-sm text-gray-400 hover:text-red-500 hover:underline ml-auto"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
