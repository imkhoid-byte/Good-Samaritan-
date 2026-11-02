import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const MEMBER_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/items/new', label: '+ Register Item' },
  { to: '/rewards', label: 'Rewards' },
  { to: '/community', label: 'Community' },
  { to: '/shop', label: 'Shop' },
  { to: '/venues', label: 'Venues' }
];

const PUBLIC_LINKS = [
  { to: '/shop', label: 'Shop tags' },
  { to: '/community', label: 'Community' },
  { to: '/partners', label: 'Partners' }
];

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/'));

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              GS
            </div>
            <span className="font-bold text-gray-900 text-lg hidden sm:block">Good Samaritan</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {user ? (
              <>
                {MEMBER_LINKS.map(l => <NavLink key={l.to} to={l.to} label={l.label} active={isActive(l.to)} />)}
                <div className="ml-2 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-sm font-medium">
                    <span>⭐</span>
                    <span>{user.points} pts</span>
                  </div>
                  <Link
                    to="/premium"
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-full ${user.subscription === 'premium' ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    {user.subscription === 'premium' ? '★ Premium' : 'Go Premium'}
                  </Link>
                  {user.unreadMessages ? (
                    <Link to="/dashboard" className="relative">
                      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-600 text-sm font-bold">
                        {user.unreadMessages}
                      </div>
                    </Link>
                  ) : null}
                  <div className="flex items-center gap-2 ml-1">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold cursor-pointer"
                      style={{ backgroundColor: user.avatarColor }}
                    >
                      {user.name[0].toUpperCase()}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {PUBLIC_LINKS.map(l => <NavLink key={l.to} to={l.to} label={l.label} active={isActive(l.to)} />)}
                <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden border-t border-gray-100 py-3 space-y-1">
            {user ? (
              <>
                <div className="px-3 py-2 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: user.avatarColor }}>
                    {user.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-green-600">{user.points} points</p>
                  </div>
                </div>
                {MEMBER_LINKS.map(l => (
                  <Link key={l.to} to={l.to} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMenuOpen(false)}>{l.label}</Link>
                ))}
                <Link to="/premium" className="block px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 rounded-lg" onClick={() => setMenuOpen(false)}>
                  {user.subscription === 'premium' ? '★ Premium settings' : 'Go Premium'}
                </Link>
                <button onClick={handleLogout} className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Sign out</button>
              </>
            ) : (
              <>
                {PUBLIC_LINKS.map(l => (
                  <Link key={l.to} to={l.to} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMenuOpen(false)}>{l.label}</Link>
                ))}
                <Link to="/login" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMenuOpen(false)}>Sign in</Link>
                <Link to="/register" className="block px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 rounded-lg" onClick={() => setMenuOpen(false)}>Get Started</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
