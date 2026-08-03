import { useEffect, useState } from 'react';
import { BarChart3, Building, CalendarDays, KeyRound, Printer, ReceiptText, Save, Settings, ShieldCheck, Users, WalletCards } from 'lucide-react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { User, Role, AuditLog } from '../types';

type Tab = 'reports' | 'settings' | 'audit';

export function Management({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab || 'reports');
  const [report, setReport] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      setError('');
      if (tab === 'reports') {
        const data = await api<any>('/reports/financial');
        setReport(data);
      } else if (tab === 'audit') {
        const logs = await api<AuditLog[]>('/audit');
        setAuditLogs(logs);
      }
      const u = await api<User[]>('/users').catch(() => []);
      setUsers(u);
    } catch (e: any) {
      setError(e.message || 'تعذر تحميل البيانات القيادية');
    }
  }

  useEffect(() => {
    void load();
  }, [tab]);

  async function handleToggleUserActive(user: User) {
    try {
      await api(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      setToast(`تم ${!user.isActive ? 'تفعيل' : 'تعطيل'} حساب ${user.fullName}`);
      load();
      setTimeout(() => setToast(''), 2500);
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="page management-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">الإدارة والمتابعة الحساسة</span>
          <h2>إدارة العيادة والمستخدمين والتدقيق ⚙️</h2>
          <p>متابعة الإيرادات والتقرير المالي، أدوار RBAC وسجل العمليات الغير قابل للتعديل.</p>
        </div>
        <div className="heading-actions">
          {tab === 'reports' && (
            <button className="button primary" onClick={() => setShowUserModal(true)}>
              <Users size={17} /> مستخدم / موظف جديد
            </button>
          )}
        </div>
      </div>

      {toast && <div className="toast">✓ {toast}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="management-tabs">
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>
          <BarChart3 size={17} /> التقارير المالية والمستخدمون
        </button>
        <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>
          <ShieldCheck size={17} /> سجل التدقيق (Audit Logs)
        </button>
      </div>

      {tab === 'reports' && (
        <>
          <div className="report-grid" style={{ marginTop: '20px' }}>
            <section className="panel report-card">
              <div className="panel-header">
                <div>
                  <h3>إجمالي الإيرادات الشهرية المحصلة</h3>
                  <p>توزيع الإيرادات المحصلة حسـب الشهر</p>
                </div>
              </div>
              <div className="report-list">
                {report?.monthlyRevenue?.map((m: any) => (
                  <p key={m.month}>
                    <span>الشهر: {m.month}</span>
                    <b>{Number(m.paid).toLocaleString('ar-EG')} ج.م (إجمالي الفواتير: {Number(m.total).toLocaleString('ar-EG')} ج.م)</b>
                  </p>
                ))}
                {(!report?.monthlyRevenue || report.monthlyRevenue.length === 0) && (
                  <p className="muted">لا توجد بيانات مالية حتى الآن</p>
                )}
              </div>
            </section>

            <section className="panel report-card">
              <div className="panel-header">
                <div>
                  <h3>مستخدمو النظام والصلاحيات (RBAC)</h3>
                  <p>الأدوار (ADMIN, VET, RECEPTIONIST, ACCOUNTANT)</p>
                </div>
              </div>
              <div className="staff-list">
                {users.map((user) => (
                  <div key={user.id}>
                    <span className="avatar light">{(user.fullName || user.username).slice(0, 1)}</span>
                    <span>
                      <strong>{user.fullName}</strong>
                      <small>{user.username} • الدور: <strong style={{ color: '#0f766e' }}>{user.role}</strong></small>
                    </span>
                    <button
                      className={`status ${user.isActive ? 'green' : 'red'}`}
                      onClick={() => handleToggleUserActive(user)}
                    >
                      <i />{user.isActive ? 'نشط' : 'موقوف'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {tab === 'audit' && (
        <section className="panel table-panel" style={{ marginTop: '20px' }}>
          <div className="panel-header">
            <div>
              <h3>سجل التدقيق للأمان (Audit Logs)</h3>
              <p>تسجيل غير قابل للحذف لأي تعديل أو إضافة حساسة مع العناوين والتاريخ والوقت والقيم</p>
            </div>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ والوقت</th>
                  <th>المستخدم</th>
                  <th>نوع الإجراء</th>
                  <th>الكيان (Entity)</th>
                  <th>البيانات المسجلة (Body)</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="mono">{new Date(log.createdAt).toLocaleString('ar-EG')}</td>
                    <td><strong>{log.user?.fullName || log.userId || 'النظام'}</strong></td>
                    <td><span className="tag teal">{log.action}</span></td>
                    <td><span className="tag purple">{log.entity}</span></td>
                    <td style={{ fontSize: '10px', direction: 'ltr', textAlign: 'left', fontFamily: 'monospace' }}>
                      {log.afterValue?.slice(0, 80)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showUserModal && (
        <UserModal
          onClose={() => setShowUserModal(false)}
          onSaved={() => {
            setShowUserModal(false);
            setToast('تم إنشاء الموظف الحساب الجديد');
            load();
            setTimeout(() => setToast(''), 2500);
          }}
        />
      )}
    </div>
  );
}

function UserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('VET');
  const [error, setError] = useState('');

  async function submit() {
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({ fullName, username, password, role }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'تعذر إنشاء حساب المستخدم');
    }
  }

  return (
    <Modal title="إضافة مستخدم وموظف جديد" subtitle="تحديد الصلاحية وتجزئة كلمة المرور بـ Argon2id" onClose={onClose}>
      <div className="form-grid">
        <label>الاسم الكامل *
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="د. علي حسان..." />
        </label>
        <label>اسم المستخدم (Login Username) *
          <input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="dr_ali" />
        </label>
        <label>كلمة المرور *
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
        </label>
        <label>الدور والصلاحية (RBAC Role) *
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="ADMIN">ADMIN — أدمن كامل الصلاحيات والتقارير</option>
            <option value="VET">VET — طبيب بيطري (كشوف، روشتات، تطعيمات)</option>
            <option value="RECEPTIONIST">RECEPTIONIST — استقبال ومواعيد</option>
            <option value="ACCOUNTANT">ACCOUNTANT — محاسب وفواتير ومخزون</option>
          </select>
        </label>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="modal-actions">
        <button className="button primary" onClick={() => void submit()} disabled={!fullName || !username || password.length < 5}>
          إنشاء الحساب
        </button>
        <button className="button secondary" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
