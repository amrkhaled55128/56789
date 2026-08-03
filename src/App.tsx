import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { api, clearSession, getToken } from './api';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Reception } from './pages/Reception';
import { Clients } from './pages/Clients';
import { PetProfilePage } from './pages/PetProfilePage';
import { Inventory } from './pages/Inventory';
import { Visits } from './pages/Visits';
import { Vaccinations } from './pages/Vaccinations';
import { Billing } from './pages/Billing';
import { Expenses } from './pages/Expenses';
import { Operations } from './pages/Operations';
import { Management } from './pages/Management';
import type { User } from './types';

function AuthenticatedApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <Layout user={user} onLogout={onLogout}>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('vet_clinic_user');
    return saved && getToken() ? (JSON.parse(saved) as User) : null;
  });

  function logout() {
    api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearSession();
    setUser(null);
    navigate('/');
  }

  if (!user) return <Login onLogin={setUser} />;
  return <AuthenticatedApp user={user} onLogout={logout} />;
}
