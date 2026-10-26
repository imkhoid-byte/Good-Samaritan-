import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { VENUE_TYPES, venueIcon } from '../venue';

interface VenueSummary {
  id: string;
  name: string;
  venueType: string;
  role: string;
  tagCount: number;
  foundCount: number;
}

export default function Venues() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', venueType: 'coat_check', returnInstructions: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/orgs')
      .then(({ data }) => { setVenues(data); setShowForm(data.length === 0); })
      .finally(() => setLoading(false));
  }, []);

  async function createVenue(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post('/api/orgs', form);
      navigate(`/venues/${data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create venue.');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Venues</h1>
        {!showForm && <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ New venue</button>}
      </div>
      <p className="text-gray-500 mb-8">
        Print blank tags for your coat check, lost & found or front desk. Guests link a tag to their phone with one scan, no app or account.
      </p>

      {showForm && (
        <form onSubmit={createVenue} className="card p-6 mb-8 space-y-4">
          <h2 className="font-semibold text-gray-900">Set up a venue</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Venue name</label>
            <input className="input-field" placeholder="The Blue Room" maxLength={100} required autoFocus
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VENUE_TYPES.map(t => (
                <button
                  type="button" key={t.value}
                  onClick={() => setForm(f => ({ ...f, venueType: t.value }))}
                  className={`border rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                    form.venueType === t.value ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Where should finders bring items? <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input className="input-field" placeholder="Coat check by the main entrance" maxLength={300}
              value={form.returnInstructions} onChange={e => setForm(f => ({ ...f, returnInstructions: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Shown to anyone who scans a found item, and texted to the owner when it reaches your desk.</p>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create venue'}</button>
            {venues.length > 0 && <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>}
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {venues.map(v => (
            <Link key={v.id} to={`/venues/${v.id}`} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-3xl">{venueIcon(v.venueType)}</span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{v.name}</h3>
                    <p className="text-xs text-gray-500 capitalize">{v.role}</p>
                  </div>
                </div>
                {v.foundCount > 0 && <span className="badge bg-amber-100 text-amber-800 shrink-0">{v.foundCount} found</span>}
              </div>
              <p className="text-sm text-gray-500 mt-3">{v.tagCount} tags printed</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
