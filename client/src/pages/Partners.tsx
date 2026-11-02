import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { apiError } from '../format';

const PROGRAMS = [
  { icon: '🏢', title: 'Corporate CSR', text: 'Tag company assets, give staff branded tags as a perk, and report the community impact in your CSR program.' },
  { icon: '🎓', title: 'Schools & campuses', text: 'Run a lost & found that returns items itself, and teach honesty and responsibility with real results.' },
  { icon: '💚', title: 'Non-profits', text: 'Become a featured charity. Finders and members donate to you every time an item comes home.' },
  { icon: '🤝', title: 'Brand sponsors', text: 'Fund the kindness pool behind every donation and co-brand tags with a message people actually keep.' }
];

const TYPES = [
  { value: 'csr', label: 'Corporate CSR program' },
  { value: 'education', label: 'School or university' },
  { value: 'nonprofit', label: 'Non-profit / charity' },
  { value: 'brand', label: 'Brand sponsorship' },
  { value: 'other', label: 'Something else' }
];

export default function Partners() {
  const [form, setForm] = useState({ orgName: '', contactName: '', email: '', partnerType: 'csr', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await api.post('/api/partners/inquiries', form);
      setSent(true);
    } catch (err) {
      setError(apiError(err, 'Could not send your inquiry'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900">Partner with Good Samaritan</h1>
        <p className="text-gray-500 mt-1">
          We work with socially responsible brands, schools and non-profits to make returning lost things the normal thing to do.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4 h-fit">
          {PROGRAMS.map(p => (
            <div key={p.title} className="card p-5">
              <div className="text-3xl mb-2">{p.icon}</div>
              <h3 className="font-semibold text-gray-900">{p.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{p.text}</p>
            </div>
          ))}
          <div className="card p-5 sm:col-span-2 bg-gray-900 border-gray-900 text-white">
            <p className="font-semibold">Running a venue?</p>
            <p className="text-sm text-gray-300 mt-1">Coat checks, hotels, airports and events can start today with printable claim-on-scan tags.</p>
            <Link to="/venues" className="inline-block mt-3 text-sm text-green-300 hover:underline">Set up venue mode →</Link>
          </div>
        </div>

        <div className="lg:col-span-2 card p-6 h-fit">
          {sent ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">🤝</div>
              <h2 className="font-bold text-gray-900 text-lg">Thank you!</h2>
              <p className="text-sm text-gray-500 mt-1">We'll be in touch within two business days.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <h2 className="font-semibold text-gray-900 mb-1">Start a conversation</h2>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
              <input className="input-field" placeholder="Organization" value={form.orgName} onChange={set('orgName')} required />
              <input className="input-field" placeholder="Your name" value={form.contactName} onChange={set('contactName')} required />
              <input className="input-field" type="email" placeholder="Work email" value={form.email} onChange={set('email')} required />
              <select className="input-field" value={form.partnerType} onChange={set('partnerType')}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <textarea className="input-field resize-none" rows={4} placeholder="What would you like to do together?" value={form.message} onChange={set('message')} />
              <button className="btn-primary w-full" disabled={sending}>{sending ? 'Sending…' : 'Send inquiry'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
