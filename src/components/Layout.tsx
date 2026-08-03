import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  CalendarDays, Gauge, LogOut, PackageOpen, PawPrint, Search, Settings, Users, WalletCards, X
} from 'lucide-react';
import { Logo } from './Logo';
import { api } from '../api';
import type { User } from '../types';

type NavigationItem = { to: string; label: string; icon: typeof Gauge };

const mainNavItems: NavigationItem[] = [
  { to: '/', label: 'الرئيسية', icon: Gauge },
  { to: '/reception', label: 'المواعيد والانتظار', icon: CalendarDays },
  { to: '/clients', label: 'العملاء والحيوانات', icon: PawPrint },
  { to: '/visits', label: 'الكشوفات والروشتات', icon: PawPrint },
  { to: '/vaccinations', label: 'التطعيمات والشهادات', icon: PawPrint },
  { to: '/billing', label: 'الفواتير والحسابات', icon: WalletCards },
  { to: '/inventory', label: 'الصيدلية والمخزون', icon: PackageOpen },
  { to: '/settings', label: 'إعدادات النظام والتدقيق', icon: Settings },
];

export function Layout({ user, onLogout, children }: { user: User; onLogout: () => void; children: ReactNode }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<{ owners: any[]; pets: any[]; products: any[] } | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults(null); setSearchOpen(false); return; }
    const timer = setTimeout(async () => {
      try {
        const [owners, pets, products] = await Promise.all([
          api<any[]>(`/owners?query=${encodeURIComponent(query)}`).catch(() => []),
          api<any[]>(`/pets?query=${encodeURIComponent(query)}`).catch(() => []),
          api<any[]>(`/inventory?query=${encodeURIComponent(query)}`).catch(() => []),
        ]);
        setResults({ owners, pets, products });
        setSearchOpen(true);
      } catch (e) {
        setResults(null);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function closeSearch() { setQuery(''); setSearchOpen(false); setResults(null); }

  const displayName = user.fullName || user.username || 'مستخدم النظام';

  return (
    <div className="top-layout-shell">
      {/* Top Navbar Header */}
      <header className="top-header-navbar">
        <div className="header-brand-section">
          <Logo />
        </div>

        {/* Horizontal Navigation Bar */}
        <nav className="top-horizontal-nav">
          {mainNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `top-nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User & Global Actions */}
        <div className="header-actions-section">
          <div className="global-search-container">
            <label className="global-search">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث سريع عن عميل، حيوان، صنف..." />
              {query && <button className="clear-search" onClick={closeSearch}><X size={14} /></button>}
            </label>
            {searchOpen && results && (
              <div className="global-search-popover panel">
                <header><span>نتائج البحث عن "{query}"</span><button onClick={closeSearch}><X size={15} /></button></header>
                <div className="search-popover-content">
                  {results.owners.length > 0 && (
                    <div className="search-group">
                      <span className="search-caption"><Users size={14} /> العملاء</span>
                      {results.owners.slice(0, 5).map((c) => (
                        <div key={c.id} className="search-item" onClick={() => { navigate('/clients'); closeSearch(); }}>
                          <strong>{c.fullName}</strong>
                          <small>{c.phone}</small>
                        </div>
                      ))}
                    </div>
                  )}
                  {results.pets.length > 0 && (
                    <div className="search-group">
                      <span className="search-caption"><PawPrint size={14} /> القطط والكلاب</span>
                      {results.pets.slice(0, 5).map((p) => (
                        <div key={p.id} className="search-item" onClick={() => { navigate(`/pets/${p.id}`); closeSearch(); }}>
                          <strong>{p.name} ({p.species === 'CAT' ? 'قطة 🐱' : 'كلب 🐶'})</strong>
                          <small>المالك: {p.owner?.fullName || 'مجهول'}</small>
                        </div>
                      ))}
                    </div>
                  )}
                  {results.products.length > 0 && (
                    <div className="search-group">
                      <span className="search-caption"><PackageOpen size={14} /> الأصناف</span>
                      {results.products.slice(0, 5).map((prd) => (
                        <div key={prd.id} className="search-item" onClick={() => { navigate('/inventory'); closeSearch(); }}>
                          <strong>{prd.name}</strong>
                          <small>الرصيد: {prd.stockQty} {prd.unit} • {prd.sellPrice} ج.م</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="user-menu-btn" onClick={onLogout} title="تسجيل الخروج">
            <span className="avatar light mini">{displayName.slice(0, 1)}</span>
            <span className="user-menu-name">{displayName}</span>
            <LogOut size={15} className="logout-icon" />
          </button>
        </div>
      </header>

      {/* Main Workspace Full Content Canvas */}
      <main className="main-content-canvas">
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
