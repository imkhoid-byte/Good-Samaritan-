import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import TagPage from './pages/TagPage';
import Venues from './pages/Venues';
import VenueDashboard from './pages/VenueDashboard';
import PrintTags from './pages/PrintTags';
import Shop from './pages/Shop';
import Premium from './pages/Premium';
import Community from './pages/Community';
import Partners from './pages/Partners';

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
      <Route path="/t/:code" element={<TagPage />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/community" element={<Community />} />
      <Route path="/partners" element={<Partners />} />
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />

      {/* Protected */}
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/items/new" element={<PrivateRoute><RegisterItem /></PrivateRoute>} />
      <Route path="/items/:id" element={<PrivateRoute><ItemDetail /></PrivateRoute>} />
      <Route path="/rewards" element={<PrivateRoute><Rewards /></PrivateRoute>} />
      <Route path="/premium" element={<PrivateRoute><Premium /></PrivateRoute>} />
      <Route path="/venues" element={<PrivateRoute><Venues /></PrivateRoute>} />
      <Route path="/venues/:orgId" element={<PrivateRoute><VenueDashboard /></PrivateRoute>} />
      <Route path="/venues/:orgId/batches/:batchId/print" element={<PrivateRoute><PrintTags /></PrivateRoute>} />

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
  const { pathname } = useLocation();
  // Scan landing pages and print sheets stand on their own, without app chrome.
  const hideNavbar = pathname.startsWith('/found/') || pathname.startsWith('/t/') || pathname.endsWith('/print');

  return (
    <div className="min-h-screen">
      {!hideNavbar && <Navbar />}
      <AppRoutes />
    </div>
  );
}
