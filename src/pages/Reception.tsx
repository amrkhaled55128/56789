import { useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, MoreHorizontal, PawPrint, Phone, Plus, Search } from 'lucide-react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { Appointment, Owner, Pet } from '../types';

const statusClass: Record<string, string> = {
  SCHEDULED: 'amber',
  CONFIRMED: 'teal',
  ARRIVED: 'blue',
  IN_PROGRESS: 'purple',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

const dateString = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export function Reception() {
  const [date, setDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [appData, ownerData, petData] = await Promise.all([
        api<Appointment[]>(`/appointments?date=${dateString(date)}`),
        api<Owner[]>('/owners'),
        api<Pet[]>('/pets'),
      ]);
      setAppointments(appData);
      setOwners(ownerData);
      setPets(petData);
    } catch (e: any) {
      setToast(e.message || 'حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [date]);

  async function updateStatus(id: string, status: string) {
    try {
      await api(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setToast('تم تحديث حالة الموعد بنجاح');
      await load();
      setTimeout(() => setToast(''), 2800);
    } catch (e: any) {
      setToast(e.message || 'حدث خطأ عند تحديث الموعد');
    }
  }

  const readableDate = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">الاستقبال واستلام الحالات</span>
          <h2>المواعيد وقائمة الانتظار اليومية 📋</h2>
          <p>تتبع حضور ووصول الحالات وتنظيم دور الطبيب البيطري.</p>
        </div>
        <button className="button primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> حجز موعد جديد
        </button>
      </div>

      {toast && <div className="toast"><Check size={17} />{toast}</div>}

      <div className="toolbar panel">
        <div className="date-switcher">
          <button className="icon-button" onClick={() => setDate(new Date(date.getTime() - 86400000))}><ChevronRight size={19} /></button>
          <CalendarDays size={18} />
          <strong>{readableDate}</strong>
          <button className="icon-button" onClick={() => setDate(new Date(date.getTime() + 86400000))}><ChevronLeft size={19} /></button>
          <button className="date-today" onClick={() => setDate(new Date())}>اليوم</button>
        </div>
      </div>

      <div className="queue-stats">
        <div>
          <span className="queue-stat-icon amber"><Clock3 /></span>
          <span><strong>{appointments.filter((a) => ['SCHEDULED', 'ARRIVED'].includes(a.status)).length}</strong><small>في الانتظار</small></span>
        </div>
        <div>
          <span className="queue-stat-icon purple"><PawPrint /></span>
          <span><strong>{appointments.filter((a) => a.status === 'IN_PROGRESS').length}</strong><small>داخل الكشف</small></span>
        </div>
        <div>
          <span className="queue-stat-icon green"><Check /></span>
          <span><strong>{appointments.filter((a) => a.status === 'COMPLETED').length}</strong><small>اكتملت</small></span>
        </div>
        <div>
          <span className="queue-stat-icon teal"><CalendarDays /></span>
          <span><strong>{appointments.length}</strong><small>إجمالي اليوم</small></span>
        </div>
      </div>

      <section className="panel appointments-panel">
        <div className="panel-header">
          <div>
            <h3>جدول مواعيد اليوم</h3>
            <p>{appointments.length} موعد مسجل</p>
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>الوقت</th>
                <th>الحيوان الأليف</th>
                <th>المالك والهاتف</th>
                <th>نوع الكشف/الخدمة</th>
                <th>حالة الموعد</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="table-message">جارٍ تحميل جدول المواعيد...</td></tr>
              ) : appointments.length === 0 ? (
                <tr><td colSpan={5} className="table-message">لا توجد مواعيد محجوزة لهذا اليوم</td></tr>
              ) : (
                appointments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong className="time-cell">
                        {new Date(a.startsAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </td>
                    <td>
                      <div className="table-pet">
                        <span className={`pet-avatar mini ${a.pet?.species === 'CAT' ? 'cat' : 'dog'}`}>
                          <PawPrint size={14} />
                        </span>
                        <strong>{a.pet?.name}</strong>
                        <small>{a.pet?.species === 'CAT' ? 'قطة 🐱' : 'كلب 🐶'}</small>
                      </div>
                    </td>
                    <td>
                      <div className="owner-cell">
                        <strong>{a.pet?.owner?.fullName || 'غير مدون'}</strong>
                        <small><Phone size={12} /> {a.pet?.owner?.phone}</small>
                      </div>
                    </td>
                    <td>{a.type}</td>
                    <td>
                      <select
                        className={`status-select ${statusClass[a.status] ?? 'gray'}`}
                        value={a.status}
                        onChange={(e) => void updateStatus(a.id, e.target.value)}
                      >
                        <option value="SCHEDULED">مجدول</option>
                        <option value="CONFIRMED">مؤكد</option>
                        <option value="ARRIVED">وصل العيادة</option>
                        <option value="IN_PROGRESS">داخل الكشف</option>
                        <option value="COMPLETED">مكتمل</option>
                        <option value="CANCELLED">ملغي</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <AppointmentModal
          date={dateString(date)}
          owners={owners}
          pets={pets}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); void load(); }}
        />
      )}
    </div>
  );
}

function AppointmentModal({
  date,
  owners,
  pets,
  onClose,
  onSaved,
}: {
  date: string;
  owners: Owner[];
  pets: Pet[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');
  const [petId, setPetId] = useState('');
  const [time, setTime] = useState('11:00');
  const [type, setType] = useState('EXAM');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const ownerPets = pets.filter((pet) => pet.ownerId === ownerId);

  useEffect(() => {
    setPetId(ownerPets[0]?.id ?? '');
  }, [ownerId]);

  async function submit() {
    try {
      const startsAt = `${date}T${time}:00.000Z`;
      await api('/appointments', {
        method: 'POST',
        body: JSON.stringify({ petId, startsAt, type, notes }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'تعذر حجز الموعد');
    }
  }

  return (
    <Modal title="حجز موعد جديد" subtitle="أضف الموعد إلى قائمة اليوم" onClose={onClose}>
      <div className="form-grid">
        <label className="full-span">
          <span>المالك *</span>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {owners.map((c) => (
              <option key={c.id} value={c.id}>{c.fullName} — {c.phone}</option>
            ))}
          </select>
        </label>

        <label className="full-span">
          <span>الحيوان الأليف *</span>
          <select value={petId} onChange={(e) => setPetId(e.target.value)}>
            {ownerPets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.species === 'CAT' ? 'قطة 🐱' : 'كلب 🐶'})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>الوقت</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>

        <label>
          <span>نوع الخدمة / الكشف</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="EXAM">كشف عام (EXAM)</option>
            <option value="VACCINE">تطعيم (VACCINE)</option>
            <option value="SURGERY">جراحة (SURGERY)</option>
            <option value="FOLLOWUP">متابعة (FOLLOWUP)</option>
            <option value="EMERGENCY">طوارئ (EMERGENCY)</option>
            <option value="LAB">تحاليل (LAB)</option>
            <option value="GROOMING">عناية وتنظيف (GROOMING)</option>
          </select>
        </label>

        <label className="full-span">
          <span>ملاحظات إضافية</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي ملاحظات قبل الحضور..." />
        </label>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="modal-actions">
        <button className="button primary" onClick={() => void submit()} disabled={!petId}>
          <Check size={17} /> تأكيد الحجز
        </button>
        <button className="button secondary" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
