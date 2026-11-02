import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { money, apiError } from '../format';

interface Stats { members: number; itemsProtected: number; itemsReturned: number; finderReports: number; donatedCents: number }
interface Story { id: string; title: string; body: string; hearts: number; createdAt: string; authorName: string; avatarColor: string }
interface Charity { id: string; name: string; cause: string; icon: string; raisedCents: number; gifts: number }
interface Charities { pointsPerDollar: number; minDonationPoints: number; charities: Charity[] }

const HEARTED_KEY = 'gs_hearted';
function loadHearted(): string[] {
  try { return JSON.parse(localStorage.getItem(HEARTED_KEY) || '[]'); } catch { return []; }
}

export function ImpactStats({ stats, dark = false }: { stats: Stats; dark?: boolean }) {
  const items = [
    { n: stats.itemsProtected.toLocaleString(), label: 'Items protected' },
    { n: stats.itemsReturned.toLocaleString(), label: 'Items returned' },
    { n: stats.finderReports.toLocaleString(), label: 'Acts of kindness' },
    { n: money(stats.donatedCents), label: 'Donated to charity' }
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
      {items.map(s => (
        <div key={s.label}>
          <div className={`text-3xl font-extrabold ${dark ? 'text-white' : 'text-green-600'}`}>{s.n}</div>
          <div className={`text-sm mt-1 ${dark ? 'text-green-100' : 'text-gray-500'}`}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Community() {
  const { user, refreshUser } = useAuth();
  const [params] = useSearchParams();
  const storyItemId = params.get('item');
  const [stats, setStats] = useState<Stats | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [charities, setCharities] = useState<Charities | null>(null);
  const [hearted, setHearted] = useState<string[]>(loadHearted);
  const [storyForm, setStoryForm] = useState({ title: '', body: '' });
  const [showStoryForm, setShowStoryForm] = useState(Boolean(storyItemId));
  const [donation, setDonation] = useState({ charityId: '', points: 100 });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get('/api/community/stats').then(r => setStats(r.data));
    api.get('/api/community/stories').then(r => setStories(r.data));
    api.get('/api/community/charities').then(r => setCharities(r.data));
  }
  useEffect(load, []);

  async function heart(id: string) {
    if (hearted.includes(id)) return;
    const { data } = await api.post(`/api/community/stories/${id}/heart`);
    setStories(s => s.map(x => (x.id === id ? { ...x, hearts: data.hearts } : x)));
    const next = [...hearted, id];
    setHearted(next);
    try { localStorage.setItem(HEARTED_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  }

  async function submit(fn: () => Promise<string>) {
    setBusy(true); setError(''); setNotice('');
    try {
      setNotice(await fn());
      load();
      refreshUser();
    } catch (err) {
      setError(apiError(err, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  }

  function postStory(e: React.FormEvent) {
    e.preventDefault();
    submit(async () => {
      const { data } = await api.post('/api/community/stories', { ...storyForm, itemId: storyItemId || undefined });
      setStoryForm({ title: '', body: '' });
      setShowStoryForm(false);
      return data.pointsEarned ? `Story shared. +${data.pointsEarned} points!` : 'Story shared. Thank you!';
    });
  }

  function donate(e: React.FormEvent) {
    e.preventDefault();
    submit(async () => {
      const { data } = await api.post('/api/community/donate', donation);
      return `You donated ${money(data.cents)} to ${data.charity}. 💚`;
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">The Good Samaritan community</h1>
        <p className="text-gray-500 mt-1">Every return is a small act of kindness. Here's what this community has done together.</p>
      </div>

      {stats && <div className="card p-6 mb-8"><ImpactStats stats={stats} /></div>}

      {notice && <div className="mb-4 bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg">{notice}</div>}
      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Stories */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-lg">Stories of kindness</h2>
            {user ? (
              <button className="btn-secondary text-sm px-4 py-2" onClick={() => setShowStoryForm(v => !v)}>
                {showStoryForm ? 'Close' : '✍️ Share your story'}
              </button>
            ) : (
              <Link to="/register" className="text-sm text-green-600 hover:underline">Join to share yours →</Link>
            )}
          </div>

          {showStoryForm && user && (
            <form onSubmit={postStory} className="card p-5 mb-4 space-y-3">
              {storyItemId && <p className="text-xs text-green-700">Sharing the story of an item that came home. +20 points.</p>}
              <input className="input-field" placeholder="Title, e.g. “A stranger returned my keys in the rain”" maxLength={120}
                value={storyForm.title} onChange={e => setStoryForm(f => ({ ...f, title: e.target.value }))} required />
              <textarea className="input-field resize-none" rows={4} maxLength={2000} placeholder="What happened? Thank your Good Samaritan."
                value={storyForm.body} onChange={e => setStoryForm(f => ({ ...f, body: e.target.value }))} required />
              <button className="btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post story'}</button>
            </form>
          )}

          {stories.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              <div className="text-3xl mb-2">📖</div>
              <p className="text-sm">No stories yet. When something you lost comes home, tell us about it.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stories.map(s => (
                <article key={s.id} className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: s.avatarColor }}>
                      {s.authorName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.authorName}</p>
                      <p className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{s.body}</p>
                  <button
                    onClick={() => heart(s.id)}
                    className={`mt-3 text-sm ${hearted.includes(s.id) ? 'text-rose-600' : 'text-gray-400 hover:text-rose-500'}`}
                    aria-label="Send a heart"
                  >
                    {hearted.includes(s.id) ? '♥' : '♡'} {s.hearts}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Charities */}
        <aside>
          <h2 className="font-semibold text-gray-900 text-lg mb-4">Charities we support</h2>
          <div className="card p-5">
            <p className="text-sm text-gray-500 mb-4">
              Finders choose a charity when they report an item and we donate on their behalf.
              Members can also turn points into donations ({charities?.pointsPerDollar ?? 100} points = $1), funded by our sponsors.
            </p>
            <ul className="space-y-3 mb-5">
              {charities?.charities.map(c => (
                <li key={c.id} className="flex gap-3">
                  <span className="text-2xl">{c.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.cause}</p>
                    <p className="text-xs text-green-700 mt-0.5">{money(c.raisedCents)} raised · {c.gifts} gift{c.gifts === 1 ? '' : 's'}</p>
                  </div>
                </li>
              ))}
            </ul>
            {user && charities ? (
              <form onSubmit={donate} className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900">Donate your points <span className="font-normal text-gray-400">({user.points} available)</span></p>
                <select className="input-field" value={donation.charityId} onChange={e => setDonation(d => ({ ...d, charityId: e.target.value }))} required>
                  <option value="">Choose a charity…</option>
                  {charities.charities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <input type="number" className="input-field" min={charities.minDonationPoints} step={charities.pointsPerDollar}
                    value={donation.points} onChange={e => setDonation(d => ({ ...d, points: Number(e.target.value) }))} />
                  <span className="text-sm text-gray-500 shrink-0">= {money((donation.points / charities.pointsPerDollar) * 100)}</span>
                </div>
                <button className="btn-primary w-full" disabled={busy || user.points < donation.points}>
                  {user.points < donation.points ? 'Not enough points' : 'Donate'}
                </button>
              </form>
            ) : (
              <Link to="/register" className="btn-primary w-full block text-center">Join and start giving</Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
