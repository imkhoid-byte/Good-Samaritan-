import React from 'react';
import { Link } from 'react-router-dom';

const FEATURES = [
  {
    icon: '📦',
    title: 'Register Your Items',
    desc: 'Add your valuables — keys, wallets, bags, electronics — and generate unique QR codes for each one instantly.'
  },
  {
    icon: '🔖',
    title: 'Attach QR Tags',
    desc: 'Print or order our eco-friendly QR tags and attach them to your belongings. Waterproof, durable, and discreet.'
  },
  {
    icon: '📱',
    title: 'Finder Scans & Connects',
    desc: 'When someone finds your item, they scan the QR code and send you a message — no personal info exposed.'
  },
  {
    icon: '🏆',
    title: 'Earn Rewards',
    desc: 'Build your Good Samaritan score. Finders and owners both earn points redeemable for exclusive benefits.'
  }
];

const STATS = [
  { number: '50K+', label: 'Items Registered' },
  { number: '12K+', label: 'Items Returned' },
  { number: '35K+', label: 'Good Samaritans' },
  { number: '98%', label: 'Success Rate' }
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Create your account', desc: 'Sign up free in under a minute.' },
  { step: '2', title: 'Register an item', desc: 'Add a name, description, and category.' },
  { step: '3', title: 'Download your QR code', desc: 'Print it or attach our premium tag.' },
  { step: '4', title: 'If lost, get found', desc: 'Finders scan the QR and contact you anonymously.' }
];

export default function Landing() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-50 via-white to-emerald-50 pt-20 pb-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <span>🌱</span> Eco-friendly · Community-driven · Privacy-first
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            Lost Items <span className="text-green-600">Found</span><br />by Good People
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Attach smart QR tags to your belongings. When someone finds them,
            they scan the code and reach you instantly — no personal info shared.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="btn-primary text-base px-8 py-3">
              Start for Free
            </Link>
            <Link to="/login" className="btn-secondary text-base px-8 py-3">
              Sign In
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">Free forever · No credit card needed</p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-green-600 py-14">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <div className="text-3xl font-extrabold text-white">{s.number}</div>
              <div className="text-green-100 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">How it works</h2>
          <p className="text-center text-gray-500 mb-12">Simple, secure, and powered by community kindness.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="card p-6 hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step by step */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Get started in 4 steps</h2>
          <div className="space-y-6">
            {HOW_IT_WORKS.map(h => (
              <div key={h.step} className="flex items-start gap-5">
                <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center text-lg font-bold shrink-0">
                  {h.step}
                </div>
                <div className="pt-1">
                  <h3 className="font-semibold text-gray-900">{h.title}</h3>
                  <p className="text-gray-500 text-sm mt-0.5">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Venues */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-gray-900 text-white rounded-full px-3 py-1 text-xs font-medium mb-4">For venues</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Coat checks, lost & found, front desks</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Print a stack of blank tags. Guests scan their stub once to link it to their phone, with no app and no sign-up.
              If an item wanders off, whoever finds it scans the tag and it comes straight back to your desk, with the owner already notified.
            </p>
            <Link to="/venues" className="btn-primary">Set up your venue</Link>
          </div>
          <ol className="space-y-4">
            {[
              ['🖨', 'Print tag pairs', 'One half on the coat, the guest keeps the stub. Reusable every night.'],
              ['📱', 'Guest scans the stub', 'Phone number in, done. Ten seconds.'],
              ['🙌', 'Anyone who finds it scans', 'One tap: hand it to your staff, or message the owner.'],
              ['✅', 'Staff scan to return', 'Mark it returned and the tag resets for the next guest.']
            ].map(([icon, title, desc]) => (
              <li key={title} className="card p-4 flex gap-4">
                <span className="text-2xl">{icon}</span>
                <span>
                  <span className="block font-semibold text-gray-900">{title}</span>
                  <span className="block text-sm text-gray-500">{desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-green-600 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">Join thousands of Good Samaritans</h2>
          <p className="text-green-100 mb-8 text-lg">Protect what matters. Reward kindness. Build community.</p>
          <Link to="/register" className="bg-white text-green-700 font-semibold px-8 py-3 rounded-lg hover:bg-green-50 transition-colors text-base">
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-600 rounded-md flex items-center justify-center text-white text-xs font-bold">GS</div>
            <span className="text-white font-semibold">Good Samaritan</span>
          </div>
          <p className="text-sm">© 2024 Good Samaritan QR. Built for a kinder, more responsible world.</p>
        </div>
      </footer>
    </div>
  );
}
