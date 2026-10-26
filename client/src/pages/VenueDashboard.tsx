import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { TAG_STATUS, EVENT_LABELS, venueIcon, formatWhen } from '../venue';

interface Venue {
  id: string;
  name: string;
  venueType: string;
  returnInstructions: string | null;
  role: 'owner' | 'staff';
  stats: Record<string, number>;
  members: { id: string; name: string; email: string; role: string }[];
  batches: { id: string; label: string; count: number; createdAt: string }[];
}

interface TagRow {
  code: string;
  seq: number;
  status: string;
  label: string | null;
  ownerName: string | null;
  lastEvent: string | null;
  lastEventAt: string | null;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'found', label: 'Found' },
  { value: 'at_desk', label: 'At desk' },
  { value: 'active', label: 'Checked in' },
  { value: 'returned', label: 'Returned' },
  { value: 'unclaimed', label: 'Unclaimed' }
];

export default function VenueDashboard() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');

  const loadVenue = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/orgs/${orgId}`);
      setVenue(data);
    } catch {
      navigate('/venues');
    }
  }, [orgId]);

  const loadTags = useCallback(async () => {
    const { data } = await api.get(`/api/orgs/${orgId}/tags`, { params: { status: filter || undefined, q: query || undefined } });
    setTags(data);
  }, [orgId, filter, query]);

  useEffect(() => { loadVenue(); }, [loadVenue]);
  useEffect(() => {
    const t = setTimeout(loadTags, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [loadTags]);

  // Staff at a desk type the code off a sticker; jump straight to it.
  function lookup(e: React.FormEvent) {
    e.preventDefault();
    const raw = query.trim();
    const exact = tags.find(t => String(t.seq) === raw || t.code === raw.toUpperCase().replace(/[^0-9A-Z]/g, ''));
    if (exact) navigate(`/t/${exact.code}`);
    else if (tags.length === 1) navigate(`/t/${tags[0].code}`);
  }

  if (!venue) return <div className="text-center py-20 text-gray-400">Loading…</div>;

  const isOwner = venue.role === 'owner';
  const needsAttention = venue.stats.found + venue.stats.at_desk;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to="/venues" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">← All venues</Link>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">{venueIcon(venue.venueType)}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{venue.name}</h1>
          <p className="text-sm text-gray-500">{venue.returnInstructions || 'No return instructions set'}</p>
        </div>
      </div>

      {needsAttention > 0 && (
        <button onClick={() => setFilter('found')} className="w-full mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-left">
          <span className="text-2xl">🙌</span>
          <span>
            <span className="block font-semibold text-amber-900">{needsAttention} item{needsAttention > 1 ? 's' : ''} found and waiting to go home</span>
            <span className="block text-sm text-amber-800">Owners have been notified. Tap to see them.</span>
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {(['active', 'found', 'at_desk', 'returned', 'unclaimed'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`card p-4 text-left transition-shadow hover:shadow-md ${filter === s ? 'ring-2 ring-green-500' : ''}`}>
            <div className="text-2xl font-bold text-gray-900">{venue.stats[s] ?? 0}</div>
            <div className="text-xs text-gray-500">{TAG_STATUS[s].label}</div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-4 border-b border-gray-100 space-y-3">
              <form onSubmit={lookup}>
                <input
                  className="input-field" placeholder="Look up a tag: number, code, item or name"
                  value={query} onChange={e => setQuery(e.target.value)}
                />
              </form>
              <div className="flex gap-1.5 flex-wrap">
                {FILTERS.map(f => (
                  <button
                    key={f.value} onClick={() => setFilter(f.value)}
                    className={`px-3 py-1 rounded-full text-sm ${filter === f.value ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {tags.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">
                {venue.batches.length === 0 ? 'Print your first batch of tags to get started →' : 'No tags match.'}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {tags.map(t => (
                  <li key={t.code}>
                    <Link to={`/t/${t.code}`} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                      <span className="w-12 text-lg font-bold text-gray-900 shrink-0">#{t.seq}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {t.label || <span className="text-gray-400">{t.code.slice(0, 4)}-{t.code.slice(4)}</span>}
                          {t.ownerName && <span className="text-gray-500 font-normal"> · {t.ownerName}</span>}
                        </p>
                        {t.lastEvent && t.lastEventAt && (
                          <p className="text-xs text-gray-400 truncate">{EVENT_LABELS[t.lastEvent]?.label || t.lastEvent} · {formatWhen(t.lastEventAt)}</p>
                        )}
                      </div>
                      <span className={`badge shrink-0 ${TAG_STATUS[t.status]?.color}`}>{TAG_STATUS[t.status]?.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <BatchPanel venue={venue} onCreated={() => { loadVenue(); loadTags(); }} />
          <StaffPanel venue={venue} isOwner={isOwner} currentUserId={user?.id} onChange={loadVenue} />
          {isOwner && <SettingsPanel venue={venue} onSaved={loadVenue} />}
        </div>
      </div>
    </div>
  );
}

function BatchPanel({ venue, onCreated }: { venue: Venue; onCreated: () => void }) {
  const [count, setCount] = useState(30);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post(`/api/orgs/${venue.id}/batches`, { count, label });
      setLabel('');
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create tags.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Print tags</h2>
      <p className="text-xs text-gray-500 mb-4">Each tag prints as a pair: one half goes on the item, the guest keeps the stub. Tags can be reset and reused.</p>
      <form onSubmit={create} className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <input type="number" min={1} max={500} className="input-field w-24" value={count} onChange={e => setCount(Number(e.target.value))} />
          <input className="input-field flex-1" placeholder="Label (e.g. Friday)" maxLength={80} value={label} onChange={e => setLabel(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary w-full text-sm" disabled={saving}>{saving ? 'Creating…' : `Create ${count || ''} tags`}</button>
      </form>
      {venue.batches.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
          {venue.batches.map(b => (
            <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block text-gray-900 truncate">{b.label}</span>
                <span className="block text-xs text-gray-400">{b.count} tags · {new Date(b.createdAt).toLocaleDateString()}</span>
              </span>
              <Link to={`/venues/${venue.id}/batches/${b.id}/print`} className="text-green-700 font-medium hover:underline shrink-0">🖨 Print</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StaffPanel({ venue, isOwner, currentUserId, onChange }: { venue: Venue; isOwner: boolean; currentUserId?: string; onChange: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/api/orgs/${venue.id}/members`, { email });
      setEmail('');
      onChange();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not add staff member.');
    }
  }

  async function remove(userId: string, name: string) {
    if (!confirm(`Remove ${name} from ${venue.name}?`)) return;
    await api.delete(`/api/orgs/${venue.id}/members/${userId}`);
    onChange();
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Staff</h2>
      <p className="text-xs text-gray-500 mb-3">Staff who are signed in see check-in and return controls when they scan a tag.</p>
      <ul className="space-y-2 mb-3">
        {venue.members.map(m => (
          <li key={m.id} className="flex items-center justify-between text-sm gap-2">
            <span className="min-w-0">
              <span className="block text-gray-900 truncate">{m.name}</span>
              <span className="block text-xs text-gray-400 truncate">{m.email} · {m.role}</span>
            </span>
            {isOwner && m.id !== currentUserId && (
              <button onClick={() => remove(m.id, m.name)} className="text-xs text-gray-400 hover:text-red-600 shrink-0">Remove</button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form onSubmit={add} className="space-y-2">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <input type="email" required className="input-field flex-1 text-sm" placeholder="staff@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            <button type="submit" className="btn-secondary text-sm px-4">Add</button>
          </div>
        </form>
      )}
    </div>
  );
}

function SettingsPanel({ venue, onSaved }: { venue: Venue; onSaved: () => void }) {
  const [instructions, setInstructions] = useState(venue.returnInstructions || '');
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api.patch(`/api/orgs/${venue.id}`, { returnInstructions: instructions });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  }

  return (
    <form onSubmit={save} className="card p-5 space-y-3">
      <h2 className="font-semibold text-gray-900">Return instructions</h2>
      <textarea className="input-field resize-none text-sm" rows={2} maxLength={300} placeholder="Coat check by the main entrance"
        value={instructions} onChange={e => setInstructions(e.target.value)} />
      <button type="submit" className="btn-secondary w-full text-sm">{saved ? 'Saved ✓' : 'Save'}</button>
    </form>
  );
}
