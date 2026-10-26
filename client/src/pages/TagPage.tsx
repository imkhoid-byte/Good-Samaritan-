import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import {
  TAG_STATUS, EVENT_LABELS, TagEvent, venueIcon,
  getOwnerToken, saveOwnerToken, formatWhen, getLocation
} from '../venue';

interface TagView {
  code: string;
  displayCode: string;
  status: string;
  isClaimed: boolean;
  label: string | null;
  venue: { name: string; venueType: string; returnInstructions: string | null };
  viewer: 'owner' | 'staff' | 'public';
  canClaim?: boolean;
  seq?: number;
  orgId?: string;
  ownerName?: string | null;
  ownerHasEmail?: boolean;
  ownerHasPhone?: boolean;
  claimedAt?: string | null;
  events?: TagEvent[];
}

export default function TagPage() {
  const { code = '' } = useParams<{ code: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const claimKey = searchParams.get('k') || '';
  const [tag, setTag] = useState<TagView | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);

  const load = useCallback(async () => {
    const token = getOwnerToken(code.toUpperCase());
    try {
      const { data } = await api.get(`/api/tags/${code}`, {
        params: claimKey ? { k: claimKey } : undefined,
        headers: token ? { 'X-Owner-Token': token } : undefined
      });
      setTag(data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [code, claimKey]);

  useEffect(() => {
    // Private owner links (?o=…) arrive by text/email. Keep the token on this
    // device and drop it from the address bar so it isn't shared by accident.
    const ownerToken = searchParams.get('o');
    if (ownerToken) {
      saveOwnerToken(code.toUpperCase(), ownerToken);
      searchParams.delete('o');
      setSearchParams(searchParams, { replace: true });
      return;
    }
    load();
  }, [load, searchParams]);

  function onClaimed(token: string) {
    saveOwnerToken(code.toUpperCase(), token);
    setJustClaimed(true);
    // The claim key has done its job; reload as the owner.
    setSearchParams({}, { replace: true });
  }

  if (loading) {
    return <Shell><div className="text-center text-gray-400 py-20">Loading…</div></Shell>;
  }
  if (notFound || !tag) {
    return (
      <Shell>
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Tag not found</h1>
          <p className="text-gray-500 text-sm">Double-check the code printed under the QR, or hand the item to staff nearby.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell venue={tag.venue}>
      {tag.viewer === 'staff' ? <StaffView tag={tag} reload={load} />
        : tag.viewer === 'owner' ? <OwnerView tag={tag} reload={load} justClaimed={justClaimed} />
        : tag.canClaim ? <ClaimView tag={tag} claimKey={claimKey} onClaimed={onClaimed} />
        : <FinderView tag={tag} triedToClaim={Boolean(claimKey)} />}
    </Shell>
  );
}

function Shell({ venue, children }: { venue?: TagView['venue']; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 px-4 py-8">
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">GS</div>
            <span className="font-bold text-gray-900">Good Samaritan</span>
          </Link>
          {venue && (
            <span className="text-sm text-gray-600 bg-white/70 border border-gray-200 rounded-full px-3 py-1 truncate max-w-[50%]">
              {venueIcon(venue.venueType)} {venue.name}
            </span>
          )}
        </div>
        {children}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by <Link to="/" className="text-green-600 hover:underline">Good Samaritan</Link> · Contact details stay private
        </p>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{message}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = TAG_STATUS[status] || TAG_STATUS.active;
  return <span className={`badge ${cfg.color}`}>{cfg.label}</span>;
}

function Timeline({ events }: { events: TagEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-gray-400">No activity yet.</p>;
  return (
    <ol className="space-y-4">
      {events.map(e => {
        const cfg = EVENT_LABELS[e.type] || { label: e.type, icon: '•' };
        return (
          <li key={e.id} className="flex gap-3">
            <span className="text-lg leading-6 shrink-0">{cfg.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{cfg.label}</p>
                <time className="text-xs text-gray-400 shrink-0">{formatWhen(e.createdAt)}</time>
              </div>
              {e.message && <p className="text-sm text-gray-700 mt-1 bg-gray-50 rounded-lg px-3 py-2">“{e.message}”</p>}
              {(e.finderName || e.finderContact) && (
                <p className="text-xs text-gray-500 mt-1">
                  From {e.finderName || 'a finder'}{e.finderContact && <> · <span className="font-medium text-gray-700 break-all">{e.finderContact}</span></>}
                </p>
              )}
              {e.lat !== null && e.lng !== null && (
                <a
                  href={`https://maps.google.com/?q=${e.lat},${e.lng}`}
                  target="_blank" rel="noreferrer"
                  className="text-xs text-green-600 hover:underline mt-1 inline-block"
                >
                  📍 View where it was found
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Guest with the stub: link the tag to their phone ──────────────────────────

function ClaimView({ tag, claimKey, onClaimed }: { tag: TagView; claimKey: string; onClaimed: (token: string) => void }) {
  const [form, setForm] = useState({ label: '', ownerName: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post(`/api/tags/${tag.code}/claim`, { ...form, claimKey });
      onClaimed(data.ownerToken);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🏷️</div>
        <h1 className="text-2xl font-bold text-gray-900">Link this tag to you</h1>
        <p className="text-gray-500 text-sm mt-1">
          If your item turns up somewhere it shouldn’t, we’ll let you know. Takes 10 seconds, no account needed.
        </p>
        <p className="text-xs text-gray-400 mt-2 font-mono">Tag {tag.displayCode}</p>
      </div>
      <ErrorBox message={error} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile number</label>
          <input
            type="tel" inputMode="tel" autoComplete="tel" className="input-field" placeholder="(555) 123-4567"
            value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email <span className="text-gray-400 font-normal">(or instead of phone)</span>
          </label>
          <input
            type="email" autoComplete="email" className="input-field" placeholder="you@example.com"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            What is it? <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            className="input-field" placeholder="Black wool coat" maxLength={80}
            value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-1">Shown to whoever finds it, so they know they’ve got the right thing.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            First name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            className="input-field" placeholder="Sam" autoComplete="given-name" maxLength={80}
            value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-1">Only staff see this.</p>
        </div>
        <button type="submit" className="btn-primary w-full py-3 text-base" disabled={saving || (!form.phone.trim() && !form.email.trim())}>
          {saving ? 'Linking…' : 'Link tag to me'}
        </button>
      </form>
      <p className="text-xs text-gray-400 text-center mt-4">
        Your number and email are never shown to finders.
      </p>
    </div>
  );
}

// ─── Someone found the item ───────────────────────────────────────────────────

function FinderView({ tag, triedToClaim }: { tag: TagView; triedToClaim: boolean }) {
  const [mode, setMode] = useState<'choose' | 'staff' | 'owner' | 'done'>('choose');
  const [form, setForm] = useState({ message: '', finderName: '', finderContact: '' });
  const [shareLocation, setShareLocation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const venue = tag.venue;

  if (tag.status === 'returned') {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-xl font-bold text-gray-900">Already back with its owner</h1>
        <p className="text-sm text-gray-500 mt-1">Nothing more to do. Thanks for checking!</p>
      </div>
    );
  }

  async function submit(handoff: 'staff' | 'owner', e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    setSending(true);
    try {
      const location = shareLocation ? await getLocation() : null;
      await api.post(`/api/tags/${tag.code}/report`, { handoff, ...form, ...location });
      setMode('done');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (mode === 'done') {
    return (
      <div className="card p-8 text-center">
        <div className="text-5xl mb-3">🎉</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Thank you, Good Samaritan!</h1>
        <p className="text-sm text-gray-600">
          {tag.isClaimed ? 'The owner has been notified. ' : ''}
          {venue.returnInstructions || `Please drop it with ${venue.name} staff when you can.`}
        </p>
        <Link to="/register" className="block mt-6 text-sm text-green-600 hover:underline">
          Tag your own things for free →
        </Link>
      </div>
    );
  }

  const locationToggle = (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      <input type="checkbox" className="rounded text-green-600" checked={shareLocation} onChange={e => setShareLocation(e.target.checked)} />
      Share where I found it (uses your location once)
    </label>
  );

  return (
    <>
      {triedToClaim && tag.isClaimed && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg">
          This tag is already linked. If it’s yours, open the link we texted or emailed you when you claimed it.
        </div>
      )}
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">🙌</div>
        <h1 className="text-2xl font-bold text-gray-900">You found something!</h1>
        {tag.label && <p className="text-lg text-gray-700 mt-1 font-medium">{tag.label}</p>}
        <p className="text-gray-500 text-sm mt-1">
          {tag.isClaimed ? `Checked in at ${venue.name}. Help it get home.` : `This belongs with ${venue.name}.`}
        </p>
      </div>

      <ErrorBox message={error} />

      {mode === 'choose' && (
        <div className="space-y-3">
          <button onClick={() => setMode('staff')} className="card w-full p-5 text-left hover:shadow-md transition-shadow flex items-center gap-4">
            <span className="text-3xl">{venueIcon(venue.venueType)}</span>
            <span>
              <span className="block font-semibold text-gray-900">I’ll hand it to {venue.name}</span>
              <span className="block text-sm text-gray-500">Quickest. We’ll tell the owner it’s on its way.</span>
            </span>
          </button>
          {tag.isClaimed && (
            <button onClick={() => setMode('owner')} className="card w-full p-5 text-left hover:shadow-md transition-shadow flex items-center gap-4">
              <span className="text-3xl">💬</span>
              <span>
                <span className="block font-semibold text-gray-900">Message the owner</span>
                <span className="block text-sm text-gray-500">They’ll get it by text or email. Your details stay optional.</span>
              </span>
            </button>
          )}
        </div>
      )}

      {mode === 'staff' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Hand it to {venue.name}</h2>
          {venue.returnInstructions && (
            <p className="text-sm text-gray-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">📍 {venue.returnInstructions}</p>
          )}
          <textarea
            className="input-field resize-none" rows={2} maxLength={1000}
            placeholder="Optional note, e.g. “Found it on a chair by the bar”"
            value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          />
          {locationToggle}
          <button onClick={() => submit('staff')} className="btn-primary w-full py-3" disabled={sending}>
            {sending ? 'Sending…' : 'I’m handing it in'}
          </button>
          <button onClick={() => setMode('choose')} className="w-full text-sm text-gray-500 hover:underline">Back</button>
        </div>
      )}

      {mode === 'owner' && (
        <form onSubmit={e => submit('owner', e)} className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Message the owner</h2>
          <textarea
            className="input-field resize-none" rows={3} maxLength={1000} required autoFocus
            placeholder="Hi! I found your item. I’m near…"
            value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          />
          <input
            className="input-field" placeholder="Your name (optional)" maxLength={80}
            value={form.finderName} onChange={e => setForm(f => ({ ...f, finderName: e.target.value }))}
          />
          <input
            className="input-field" placeholder="Phone or email to reach you (optional)" maxLength={200}
            value={form.finderContact} onChange={e => setForm(f => ({ ...f, finderContact: e.target.value }))}
          />
          {locationToggle}
          <button type="submit" className="btn-primary w-full py-3" disabled={sending || !form.message.trim()}>
            {sending ? 'Sending…' : 'Send to owner'}
          </button>
          <button type="button" onClick={() => setMode('choose')} className="w-full text-sm text-gray-500 hover:underline">Back</button>
        </form>
      )}
    </>
  );
}

// ─── The guest who claimed it ────────────────────────────────────────────────

const OWNER_HEADLINES: Record<string, { icon: string; title: (v: string) => string }> = {
  active: { icon: '🧾', title: v => `Checked in at ${v}` },
  found: { icon: '🙌', title: () => 'Someone found it!' },
  at_desk: { icon: '📥', title: v => `Waiting for you at ${v}` },
  returned: { icon: '✅', title: () => 'Back with you' }
};

function OwnerView({ tag, reload, justClaimed }: { tag: TagView; reload: () => void; justClaimed: boolean }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const headline = OWNER_HEADLINES[tag.status] || OWNER_HEADLINES.active;
  const token = getOwnerToken(tag.code);
  const privateLink = `${window.location.origin}/t/${tag.code}${token ? `?o=${token}` : ''}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(privateLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the link is still visible below */ }
  }

  async function pickedUp() {
    setBusy(true);
    try {
      await api.post(`/api/tags/${tag.code}/owner`, { action: 'picked_up' }, { headers: token ? { 'X-Owner-Token': token } : undefined });
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {justClaimed && (
        <div className="mb-4 bg-green-600 text-white rounded-xl px-4 py-3 text-sm">
          <p className="font-semibold">You’re all set ✓</p>
          <p className="text-green-50">
            {tag.ownerHasPhone || tag.ownerHasEmail
              ? 'We’ll message you if anyone finds it. Hang on to your stub for pickup.'
              : 'Hang on to your stub for pickup.'}
          </p>
        </div>
      )}

      <div className="card p-6 text-center mb-4">
        <div className="text-5xl mb-2">{headline.icon}</div>
        <h1 className="text-xl font-bold text-gray-900">{headline.title(tag.venue.name)}</h1>
        {tag.label && <p className="text-gray-600 mt-1">{tag.label}</p>}
        <p className="text-xs text-gray-400 mt-2 font-mono">Tag {tag.displayCode}</p>
        {(tag.status === 'found' || tag.status === 'at_desk') && tag.venue.returnInstructions && (
          <p className="mt-4 text-sm text-gray-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">📍 {tag.venue.returnInstructions}</p>
        )}
        {tag.status !== 'returned' && tag.status !== 'active' && (
          <button onClick={pickedUp} disabled={busy} className="btn-primary w-full mt-4">
            {busy ? 'Saving…' : 'I’ve got it back'}
          </button>
        )}
      </div>

      <div className="card p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Activity</h2>
        <Timeline events={tag.events || []} />
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-1">Your private link</h2>
        <p className="text-xs text-gray-500 mb-3">This device remembers your tag. To check from another phone, use this link. Don’t share it.</p>
        <button onClick={copyLink} className="btn-secondary w-full text-sm">{copied ? 'Copied ✓' : '🔗 Copy private link'}</button>
      </div>
    </>
  );
}

// ─── Venue staff ─────────────────────────────────────────────────────────────

function StaffView({ tag, reload }: { tag: TagView; reload: () => void }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function act(action: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setError('');
    setBusy(action);
    try {
      await api.post(`/api/tags/${tag.code}/staff`, { action });
      reload();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Something went wrong.');
    } finally {
      setBusy('');
    }
  }

  const contact = [tag.ownerHasPhone && 'text', tag.ownerHasEmail && 'email'].filter(Boolean).join(' + ');
  // A tag is "open" while there's an item to hand back: linked to a guest, or found without one.
  const isOpen = tag.status !== 'returned' && (tag.isClaimed || tag.status !== 'unclaimed');

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="badge bg-gray-900 text-white">Staff view</span>
        {tag.orgId && <Link to={`/venues/${tag.orgId}`} className="text-sm text-green-700 hover:underline">Venue dashboard →</Link>}
      </div>

      <div className="card p-6 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-4xl font-extrabold text-gray-900">#{tag.seq}</p>
            <p className="text-sm text-gray-400 font-mono">{tag.displayCode}</p>
          </div>
          <StatusBadge status={tag.status} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-400 text-xs">Item</dt>
            <dd className="text-gray-900 font-medium">{tag.label || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs">Owner</dt>
            <dd className="text-gray-900 font-medium">{tag.isClaimed ? (tag.ownerName || 'Guest') : 'Not linked'}</dd>
          </div>
          {tag.isClaimed && (
            <div className="col-span-2">
              <dt className="text-gray-400 text-xs">Reachable by</dt>
              <dd className="text-gray-700">{contact || '—'} <span className="text-gray-400">(notified automatically)</span></dd>
            </div>
          )}
        </dl>

        <ErrorBox message={error} />
        <div className="mt-5 space-y-2">
          {tag.status !== 'at_desk' && tag.status !== 'returned' && (
            <button onClick={() => act('received')} disabled={!!busy} className="btn-secondary w-full">
              {busy === 'received' ? 'Saving…' : '📥 Received at desk'}
            </button>
          )}
          {isOpen && (
            <button onClick={() => act('return_and_reset')} disabled={!!busy} className="btn-primary w-full">
              {busy === 'return_and_reset' ? 'Saving…' : '✅ Returned · reset tag for reuse'}
            </button>
          )}
          {isOpen && tag.isClaimed && (
            <button onClick={() => act('returned')} disabled={!!busy} className="w-full text-sm text-gray-600 hover:underline py-1">
              Returned, but keep the guest’s link active
            </button>
          )}
          {tag.status === 'returned' && (
            <button onClick={() => act('reset')} disabled={!!busy} className="btn-secondary w-full">
              {busy === 'reset' ? 'Saving…' : '♻️ Reset for reuse'}
            </button>
          )}
          {isOpen && tag.isClaimed && (
            <button
              onClick={() => act('reset', 'Wipe this guest’s details and free the tag? Only do this if the item was never handed back.')}
              disabled={!!busy}
              className="w-full text-xs text-gray-400 hover:text-red-600 hover:underline py-1"
            >
              Force reset without returning
            </button>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Tag history</h2>
        <Timeline events={tag.events || []} />
      </div>
    </>
  );
}
