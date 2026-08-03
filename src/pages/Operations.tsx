import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, BedDouble, Check, FlaskConical, Hotel, PawPrint, Plus, Scissors, Search, Syringe } from 'lucide-react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { Owner, Pet } from '../types';

type Tab = 'surgery' | 'inpatient' | 'lab' | 'grooming' | 'hotel';
type RecordRow = Record<string, any>;

export function Operations({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab || 'surgery');
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [modal, setModal] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    try {
      const [o, p] = await Promise.all([api<Owner[]>('/owners'), api<Pet[]>('/pets')]);
      setOwners(o);
      setPets(p);

      if (tab === 'surgery') setRows(await api<RecordRow[]>('/surgeries'));
      if (tab === 'lab') setRows(await api<RecordRow[]>('/labs'));
      if (tab === 'hotel') setRows(await api<RecordRow[]>('/boarding'));
    } catch (e) {}
  }

  useEffect(() => {
    void load();
  }, [tab]);

  const filteredRows = rows.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      r.pet?.name?.toLowerCase().includes(s) ||
      r.procedureName?.toLowerCase().includes(s) ||
      r.testName?.toLowerCase().includes(s) ||
      r.cageNo?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="page operations-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">التشغيل المتقدم</span>
          <h2>الجراحة والتحاليل والإقامة الداخلية 🏥</h2>
          <p>ربط السجلات الطبية بالحيوانات الأليفة وسجلات التدقيق.</p>
        </div>
        <button className="button primary" onClick={() => setModal(tab)}>
          <Plus size={18} /> إضافة سجل جديد
        </button>
      </div>

      {toast && <div className="toast">✓ {toast}</div>}

      <div className="operation-tabs">
        <button className={tab === 'surgery' ? 'active' : ''} onClick={() => setTab('surgery')}>
          <Activity size={17} /><span>الجراحة والتخدير</span>
        </button>
        <button className={tab === 'lab' ? 'active' : ''} onClick={() => setTab('lab')}>
          <FlaskConical size={17} /><span>المعمل والتحاليل</span>
        </button>
        <button className={tab === 'hotel' ? 'active' : ''} onClick={() => setTab('hotel')}>
          <Hotel size={17} /><span>الفندق والإقامة</span>
        </button>
      </div>

      <div className="operation-toolbar panel">
        <label className="table-search">
          <Search size={17} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم الحيوان أو الإجراء..." />
        </label>
      </div>

      <section className="panel table-panel">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>الحيوان الأليف</th>
                <th>المالك</th>
                <th>البيان / الإجراء</th>
                <th>التفاصيل / النتيجة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr><td colSpan={5} className="table-message">لا توجد سجلات مسجلة بهذه الوحدة</td></tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="table-pet">
                        <span className={`pet-avatar mini ${row.pet?.species === 'CAT' ? 'cat' : 'dog'}`}>
                          <PawPrint size={14} />
                        </span>
                        <strong>{row.pet?.name}</strong>
                      </div>
                    </td>
                    <td>{row.pet?.owner?.fullName}</td>
                    <td>{row.procedureName || row.testName || `قفص رقم ${row.cageNo}`}</td>
                    <td>{row.anesthesia || row.result || `السعر اليومي: ${row.dailyRate} ج.م`}</td>
                    <td><span className="tag teal">{row.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(modal === 'surgery' || modal === 'inpatient') && (
        <SurgeryModal owners={owners} pets={pets} onClose={() => setModal(null)} onSaved={() => { setModal(null); setToast('تم حفظ العملية'); void load(); }} />
      )}
      {modal === 'lab' && (
        <LabModal owners={owners} pets={pets} onClose={() => setModal(null)} onSaved={() => { setModal(null); setToast('تم حفظ طلب التحليل'); void load(); }} />
      )}
      {(modal === 'hotel' || modal === 'grooming') && (
        <BoardingModal owners={owners} pets={pets} onClose={() => setModal(null)} onSaved={() => { setModal(null); setToast('تم حفظ حجز الإقامة'); void load(); }} />
      )}
    </div>
  );
}

function SurgeryModal({ owners, pets, onClose, onSaved }: { owners: Owner[]; pets: Pet[]; onClose: () => void; onSaved: () => void }) {
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');
  const [petId, setPetId] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [anesthesia, setAnesthesia] = useState('تخدير كلي (Isoflurane)');
  const [team, setTeam] = useState('د. أحمد علي');
  const [error, setError] = useState('');

  const ownerPets = pets.filter((p) => p.ownerId === ownerId);

  useEffect(() => { setPetId(ownerPets[0]?.id ?? ''); }, [ownerId]);

  async function submit() {
    try {
      await api('/surgeries', {
        method: 'POST',
        body: JSON.stringify({ petId, procedureName, anesthesia, team }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'تعذر إضافة العملية');
    }
  }

  return (
    <Modal title="حجز عملية جراحية" subtitle="متابعة تخدير وفريق الجراحة" onClose={onClose}>
      <div className="form-grid">
        <label>المالك
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {owners.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </select>
        </label>
        <label>الحيوان الأليف
          <select value={petId} onChange={(e) => setPetId(e.target.value)}>
            {ownerPets.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.species === 'CAT' ? 'قطة' : 'كلب'})</option>)}
          </select>
        </label>
        <label className="full-span">اسم العملية الجراحية *
          <input value={procedureName} onChange={(e) => setProcedureName(e.target.value)} required placeholder="مثال: تعقيم إناث (Ovariohysterectomy)..." />
        </label>
        <label>نوع التخدير
          <input value={anesthesia} onChange={(e) => setAnesthesia(e.target.value)} />
        </label>
        <label>فريق الجراحة
          <input value={team} onChange={(e) => setTeam(e.target.value)} />
        </label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <button className="button primary" onClick={() => void submit()} disabled={!petId || !procedureName}>تأكيد الجراحة</button>
        <button className="button secondary" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}

function LabModal({ owners, pets, onClose, onSaved }: { owners: Owner[]; pets: Pet[]; onClose: () => void; onSaved: () => void }) {
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');
  const [petId, setPetId] = useState('');
  const [testName, setTestName] = useState('تحليل صورة دم كاملة (CBC)');
  const [sampleType, setSampleType] = useState('عينة دم كامل');
  const [error, setError] = useState('');

  const ownerPets = pets.filter((p) => p.ownerId === ownerId);

  useEffect(() => { setPetId(ownerPets[0]?.id ?? ''); }, [ownerId]);

  async function submit() {
    try {
      await api('/labs', {
        method: 'POST',
        body: JSON.stringify({ petId, testName, sampleType }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'تعذر إضافة التحليل');
    }
  }

  return (
    <Modal title="طلب تحليل معملي" subtitle="معمل وأشعـة" onClose={onClose}>
      <div className="form-grid">
        <label>المالك
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {owners.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </select>
        </label>
        <label>الحيوان الأليف
          <select value={petId} onChange={(e) => setPetId(e.target.value)}>
            {ownerPets.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.species === 'CAT' ? 'قطة' : 'كلب'})</option>)}
          </select>
        </label>
        <label className="full-span">اسم التحليل *
          <input value={testName} onChange={(e) => setTestName(e.target.value)} required />
        </label>
        <label className="full-span">نوع العينة
          <input value={sampleType} onChange={(e) => setSampleType(e.target.value)} />
        </label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <button className="button primary" onClick={() => void submit()} disabled={!petId || !testName}>إرسال للمعمل</button>
        <button className="button secondary" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}

function BoardingModal({ owners, pets, onClose, onSaved }: { owners: Owner[]; pets: Pet[]; onClose: () => void; onSaved: () => void }) {
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');
  const [petId, setPetId] = useState('');
  const [cageNo, setCageNo] = useState('C-101');
  const [dailyRate, setDailyRate] = useState('150');
  const [dailyNotes, setDailyNotes] = useState('');
  const [error, setError] = useState('');

  const ownerPets = pets.filter((p) => p.ownerId === ownerId);

  useEffect(() => { setPetId(ownerPets[0]?.id ?? ''); }, [ownerId]);

  async function submit() {
    try {
      await api('/boarding', {
        method: 'POST',
        body: JSON.stringify({ petId, cageNo, dailyRate: Number(dailyRate), dailyNotes }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'تعذر إضافة حجز الفندق');
    }
  }

  return (
    <Modal title="حجز فندق / إقامة داخلية" subtitle="تحديد القفص والراتب اليومي" onClose={onClose}>
      <div className="form-grid">
        <label>المالك
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {owners.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </select>
        </label>
        <label>الحيوان الأليف
          <select value={petId} onChange={(e) => setPetId(e.target.value)}>
            {ownerPets.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.species === 'CAT' ? 'قطة' : 'كلب'})</option>)}
          </select>
        </label>
        <label>رقم القفص *
          <input value={cageNo} onChange={(e) => setCageNo(e.target.value)} required />
        </label>
        <label>التكلفة اليومية (ج.م) *
          <input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} required />
        </label>
        <label className="full-span">ملاحظات النظام الغذائي والتأمين
          <input value={dailyNotes} onChange={(e) => setDailyNotes(e.target.value)} />
        </label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <button className="button primary" onClick={() => void submit()} disabled={!petId || !cageNo}>تأكيد الإقامة</button>
        <button className="button secondary" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
