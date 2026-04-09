import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  pointsRequired: number;
}

interface Transaction {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

interface RewardsData {
  points: number;
  subscription: string;
  badges: Badge[];
  nextBadge: Badge | null;
  stats: {
    itemsRegistered: number;
    itemsReturned: number;
  };
  transactions: Transaction[];
}

const PREMIUM_PERKS = [
  { icon: '🔔', text: 'Real-time push notifications when items are found' },
  { icon: '🛡️', text: 'Enhanced privacy controls and anonymous mode' },
  { icon: '📊', text: 'Advanced item tracking & loss prevention insights' },
  { icon: '🌍', text: 'Priority community support' },
  { icon: '♻️', text: 'Eco-pledge: 1 tree planted per month' },
];

export default function Rewards() {
  const [data, setData] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/rewards').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!data) return null;

  const progressPct = data.nextBadge
    ? Math.min(100, Math.round((data.points / data.nextBadge.pointsRequired) * 100))
    : 100;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Rewards & Achievements</h1>
        <p className="text-gray-500 mt-1">Earn points by registering items and getting them returned.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-8">
        {/* Points */}
        <div className="md:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-4xl font-extrabold text-green-600">{data.points.toLocaleString()}</p>
              <p className="text-gray-500 text-sm mt-1">Good Samaritan Points</p>
            </div>
            <div className="text-5xl">⭐</div>
          </div>
          {data.nextBadge && (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Progress to {data.nextBadge.name}</span>
                <span className="font-medium text-green-600">{progressPct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {data.nextBadge.pointsRequired - data.points} more points needed
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-700 mb-4">Your Impact</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📦</div>
              <div>
                <div className="text-xl font-bold text-gray-900">{data.stats.itemsRegistered}</div>
                <div className="text-xs text-gray-400">Items Registered</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-2xl">🎉</div>
              <div>
                <div className="text-xl font-bold text-gray-900">{data.stats.itemsReturned}</div>
                <div className="text-xs text-gray-400">Items Returned</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Your Badges</h2>
        {data.badges.length === 0 ? (
          <p className="text-gray-400 text-sm">Earn your first badge by registering an item!</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {data.badges.map(badge => (
              <div key={badge.id} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <span className="text-2xl">{badge.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">{badge.name}</p>
                  <p className="text-xs text-green-600">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Premium */}
      {data.subscription === 'free' && (
        <div className="card p-6 mb-6 border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Good Samaritan Premium</h2>
              <p className="text-gray-500 text-sm mt-0.5">Unlock advanced features and amplify your impact.</p>
            </div>
            <div className="bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">$4.99/mo</div>
          </div>
          <ul className="space-y-2 mb-5">
            {PREMIUM_PERKS.map(p => (
              <li key={p.text} className="flex items-center gap-2 text-sm text-gray-700">
                <span>{p.icon}</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
          <button className="btn-primary w-full">Upgrade to Premium</button>
        </div>
      )}

      {/* Transaction history */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Points History</h2>
        {data.transactions.length === 0 ? (
          <p className="text-gray-400 text-sm">No transactions yet.</p>
        ) : (
          <div className="space-y-3">
            {data.transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm text-gray-700">{t.reason}</p>
                  <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`font-semibold text-sm ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {t.amount > 0 ? '+' : ''}{t.amount} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link to="/items/new" className="text-sm text-green-600 hover:underline">
          Register a new item to earn +10 points →
        </Link>
      </div>
    </div>
  );
}
