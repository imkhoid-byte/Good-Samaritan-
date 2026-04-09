import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import RegisterItem from './pages/RegisterItem';
import ItemDetail from './pages/ItemDetail';
import FoundItem from './pages/FoundItem';
import Rewards from './pages/Rewards';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-gray-400">Loading…</div></div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/found/:id" element={<FoundItem />} />
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />

      {/* Protected */}
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/items/new" element={<PrivateRoute><RegisterItem /></PrivateRoute>} />
      <Route path="/items/:id" element={<PrivateRoute><ItemDetail /></PrivateRoute>} />
      <Route path="/rewards" element={<PrivateRoute><Rewards /></PrivateRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}

function AppShell() {
  const { user } = useAuth();
  const isFoundPage = window.location.pathname.startsWith('/found/');

  return (
    <div className="min-h-screen">
      {!isFoundPage && <Navbar />}
      <AppRoutes />
    </div>
  );
}
