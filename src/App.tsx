import { Suspense, lazy, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { api, clearSession, getCurrentUser, getToken } from './api';
import { Login } from './pages/Login';
import type { User } from './types';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Reception = lazy(() => import('./pages/Reception').then((module) => ({ default: module.Reception })));
const Clients = lazy(() => import('./pages/Clients').then((module) => ({ default: module.Clients })));
const PetProfilePage = lazy(() => import('./pages/PetProfilePage').then((module) => ({ default: module.PetProfilePage })));
const Inventory = lazy(() => import('./pages/Inventory').then((module) => ({ default: module.Inventory })));
const Visits = lazy(() => import('./pages/Visits').then((module) => ({ default: module.Visits })));
const Vaccinations = lazy(() => import('./pages/Vaccinations').then((module) => ({ default: module.Vaccinations })));
const Billing = lazy(() => import('./pages/Billing').then((module) => ({ default: module.Billing })));
const Expenses = lazy(() => import('./pages/Expenses').then((module) => ({ default: module.Expenses })));
const Operations = lazy(() => import('./pages/Operations').then((module) => ({ default: module.Operations })));
const Management = lazy(() => import('./pages/Management').then((module) => ({ default: module.Management })));

function PageLoader() {
  return <div className="page-loader" role="status" aria-live="polite"><span /> جاري تحميل الصفحة…</div>;
}

function AuthenticatedApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <Layout user={user} onLogout={onLogout}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reception" element={<Reception />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/pets/:id" element={<PetProfilePage />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/visits" element={<Visits />} />
          <Route path="/vaccinations" element={<Vaccinations />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/surgery" element={<Operations initialTab="surgery" />} />
          <Route path="/inpatient" element={<Operations initialTab="inpatient" />} />
          <Route path="/lab" element={<Operations initialTab="lab" />} />
          <Route path="/grooming" element={<Operations initialTab="grooming" />} />
          <Route path="/hotel" element={<Operations initialTab="hotel" />} />
          <Route path="/reports" element={<Management initialTab="reports" />} />
          <Route path="/settings" element={<Management initialTab="settings" />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => getToken() ? getCurrentUser() as User | null : null);

  function logout() {
    api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearSession();
    setUser(null);
    navigate('/login', { replace: true });
  }

  return (
    <ErrorBoundary>
      {user ? <AuthenticatedApp user={user} onLogout={logout} /> : <Login onLogin={setUser} />}
    </ErrorBoundary>
  );
}
