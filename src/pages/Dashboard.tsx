import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpLeft, CalendarDays, CheckCircle2, Clock3, CreditCard, PawPrint, Plus, ReceiptText, Stethoscope, Users, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Appointment, AuditLog } from '../types';

const money = (value: number) => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(value);

const statusClass: Record<string, string> = {
  SCHEDULED: 'amber',
  CONFIRMED: 'teal',
  ARRIVED: 'blue',
  IN_PROGRESS: 'purple',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

const statusText: Record<string, string> = {
  SCHEDULED: 'مجدول',
  CONFIRMED: 'مؤكد',
  ARRIVED: 'وصل العيادة',
  IN_PROGRESS: 'داخل الكشف',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
};

function Metric({ label, value, detail, icon: Icon, tone, trend }: { label: string; value: string; detail: string; icon: typeof Users; tone: string; trend?: string }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={21} /></div>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <small className="metric-detail">{trend && <b><ArrowUpLeft size={13} />{trend}</b>}{detail}</small>
    </article>
  );
}

export function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      setError('');
      const [sumRes, appRes, audRes] = await Promise.all([
        api<any>('/reports/dashboard').catch(() => null),
        api<Appointment[]>('/appointments').catch(() => []),
        api<AuditLog[]>('/audit').catch(() => []),
      ]);
      setSummary(sumRes);
      setAppointments(appRes);
      setActivities(audRes);
    } catch (reason: any) {
      setError(reason.message || 'تعذر تحميل البيانات');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const today = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className="dashboard-page">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">{today}</span>
          <h2>مرحبًا بك في <em>أليف</em> 🐾</h2>
          <p>نظام إدارة العيادة البيطرية المتخصص في القطط والكلاب فقط.</p>
        </div>
        <div className="quick-actions">
          <Link className="button secondary" to="/billing"><ReceiptText size={17} /> فاتورة جديدة</Link>
          <Link className="button primary" to="/reception"><Plus size={18} /> حجز موعد</Link>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <section className="metric-grid">
        <Metric label="مواعيد اليوم" value={summary ? String(summary.todayAppointments).padStart(2, '0') : '00'} trend="100%" detail="كشوفات وحجوزات" icon={CalendarDays} tone="teal" />
        <Metric label="القطط المسجلة 🐱" value={summary ? String(summary.speciesBreakdown?.CAT || 0) : '0'} detail="ملف طبي قطط" icon={PawPrint} tone="amber" />
        <Metric label="الكلاب المسجلة 🐶" value={summary ? String(summary.speciesBreakdown?.DOG || 0) : '0'} detail="ملف طبي كلاب" icon={PawPrint} tone="purple" />
        <Metric label="إجمالي الإيرادات المحصلة" value={summary ? `${money(summary.totalRevenue || 0)} ج.م` : '0 ج.م'} detail={`مستحقات معلقة: ${money(summary?.unpaidBalance || 0)} ج.م`} icon={WalletCards} tone="blue" />
      </section>

      <div className="dashboard-grid">
        <section className="panel today-panel">
          <div className="panel-header">
            <div>
              <h3>مواعيد اليوم والانتظار</h3>
              <p>جدول مواعيد الكشف والتطعيم والجراحة اليوم</p>
            </div>
            <Link to="/reception">عرض الكل <ArrowLeft size={16} /></Link>
          </div>
          <div className="appointment-list">
            {appointments.length === 0 && (
              <div className="empty-state"><CalendarDays size={26} /><p>لا توجد مواعيد مسجلة اليوم</p></div>
            )}
            {appointments.slice(0, 5).map((app) => (
              <div className="appointment-row" key={app.id}>
                <time>{new Date(app.startsAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</time>
                <div className={`pet-avatar ${app.pet?.species === 'CAT' ? 'cat' : 'dog'}`}>
                  <PawPrint size={18} />
                </div>
                <div className="appointment-info">
                  <strong>{app.pet?.name} ({app.pet?.species === 'CAT' ? 'قطة' : 'كلب'})</strong>
                  <span>المالك: {app.pet?.owner?.fullName || 'مجهول'} • {app.type}</span>
                </div>
                <span className={`status ${statusClass[app.status] ?? 'gray'}`}><i />{statusText[app.status] || app.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel overview-panel">
          <div className="panel-header">
            <div>
              <h3>مؤشرات سريعة</h3>
              <p>حالة التطعيمات والمخزون</p>
            </div>
          </div>
          <div className="overview-items">
            <div>
              <span className="overview-icon green"><CheckCircle2 size={18} /></span>
              <span><strong>إجمالي العملاء</strong><small>أصحاب الحيوانات</small></span>
              <b>{summary?.totalOwners || 0}</b>
            </div>
            <div>
              <span className="overview-icon blue"><Stethoscope size={18} /></span>
              <span><strong>إجمالي الحيوانات</strong><small>قطط وكلاب مسجلة</small></span>
              <b>{summary?.totalPets || 0}</b>
            </div>
            <div>
              <span className="overview-icon orange"><PawPrint size={18} /></span>
              <span><strong>تطعيمات قادمة</strong><small>مستحقة قريباً</small></span>
              <b>{summary?.upcomingVaccinations?.length || 0}</b>
            </div>
            <div>
              <span className="overview-icon purple"><CreditCard size={18} /></span>
              <span><strong>نقص المخزون</strong><small>أصناف تحت حد الطلب</small></span>
              <b>{summary?.lowStockProducts?.length || 0}</b>
            </div>
          </div>
        </section>
      </div>

      <section className="panel activity-panel">
        <div className="panel-header">
          <div>
            <h3>سجل التغييرات والتدقيق (Audit Log)</h3>
            <p>سجل العمليات الحساسة المُسجلة بالنظام</p>
          </div>
        </div>
        <div className="activity-table">
          {activities.slice(0, 3).map((act, index) => (
            <div className="activity-line" key={act.id}>
              <span className={`activity-dot ${index % 3 === 0 ? 'teal' : index % 3 === 1 ? 'purple' : 'amber'}`} />
              <span>
                <strong>إجراء {act.action} على entity: {act.entity}</strong>
                <small>بواسطة: {act.user?.fullName || act.userId || 'النظام'}</small>
              </span>
              <time>{new Date(act.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          ))}
          {activities.length === 0 && <div className="empty-state">لا توجد سجلات تدقيق حتى الآن</div>}
        </div>
      </section>
    </div>
  );
}
