import { useEffect, useState } from 'react';
import { Activity, ClipboardPlus, Eye, FileHeart, HeartPulse, PawPrint, Plus, Printer, ReceiptText, Search, Stethoscope, Thermometer, Weight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { Owner, Pet, Visit } from '../types';

export function Visits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [toast, setToast] = useState('');

  async function load() {
    try {
      const [v, o, p] = await Promise.all([
        api<Visit[]>('/visits'),
        api<Owner[]>('/owners'),
        api<Pet[]>('/pets'),
      ]);
      setVisits(v);
      setOwners(o);
      setPets(p);
    } catch (err: any) {
      console.error(err);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredVisits = visits.filter((v) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      v.chiefComplaint.toLowerCase().includes(s) ||
      v.diagnosis.toLowerCase().includes(s) ||
      v.pet?.name.toLowerCase().includes(s) ||
      v.pet?.owner?.fullName.toLowerCase().includes(s)
    );
  });

  return (
    <div className="page">
      <div className="page-heading no-print">
        <div>
          <span className="eyebrow">الرعاية الطبية والتشخيص</span>
          <h2>السجل الطبي والروشتات (SOAP Visits) 🩺</h2>
          <p>تسجيل الفحص الإكلينيكي وحساب الجرعات بناءً على وزن الحيوان وإصدار الروشتات.</p>
        </div>
        <button className="button primary" onClick={() => setShowNewModal(true)}>
          <Plus size={18} /> فتح كشف / زيارة جديدة
        </button>
      </div>

      {toast && <div className="toast no-print">✓ {toast}</div>}

      <section className="medical-summary no-print">
        <div>
          <span className="medical-icon teal"><Stethoscope /></span>
          <span><strong>{visits.length}</strong><small>إجمالي الكشوفات المسجلة</small></span>
        </div>
        <div>
          <span className="medical-icon amber"><Activity /></span>
          <span><strong>{visits.filter((v) => v.status === 'OPEN').length}</strong><small>زيارات مفتوحة</small></span>
        </div>
        <div>
          <span className="medical-icon purple"><FileHeart /></span>
          <span><strong>{visits.filter((v) => v.status === 'COMPLETED').length}</strong><small>كشوفات مكتملة</small></span>
        </div>
      </section>

      <section className="panel table-panel no-print">
        <div className="panel-header">
          <div>
            <h3>سجل الكشوفات الطبية</h3>
            <p>اضغط على أي زيارة لمعاينة التفاصيل وطباعة الروشتة</p>
          </div>
          <label className="table-search">
            <Search size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم الحيوان أو المالك أو التشخيص..." />
          </label>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الحيوان الأليف</th>
                <th>المالك والهاتف</th>
                <th>الشكوى الرئيسية</th>
                <th>التشخيص</th>
                <th>الطبيب المعالج</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredVisits.length === 0 ? (
                <tr><td colSpan={8} className="table-message"><ClipboardPlus size={25} /> لا توجد كشوفات مسجلة</td></tr>
              ) : (
                filteredVisits.map((visit) => (
                  <tr key={visit.id} className="clickable-row" onClick={() => setSelectedVisit(visit)}>
                    <td className="mono">{new Date(visit.createdAt!).toLocaleDateString('ar-EG')}</td>
                    <td>
                      <div className="table-pet">
                        <span className={`pet-avatar mini ${visit.pet?.species === 'CAT' ? 'cat' : 'dog'}`}>
                          <PawPrint size={14} />
                        </span>
                        <strong>{visit.pet?.name}</strong>
                        <small>{visit.pet?.species === 'CAT' ? 'قطة 🐱' : 'كلب 🐶'}</small>
                      </div>
                    </td>
                    <td>
                      <strong>{visit.pet?.owner?.fullName || 'غير مدون'}</strong>
                      <small className="block muted">{visit.pet?.owner?.phone}</small>
                    </td>
                    <td>{visit.chiefComplaint}</td>
                    <td>{visit.diagnosis || <span className="muted">لم يسجل بعد</span>}</td>
                    <td>{visit.vet?.fullName || '—'}</td>
                    <td>
                      <span className={`status ${visit.status === 'COMPLETED' ? 'green' : 'amber'}`}>
                        <i />{visit.status === 'COMPLETED' ? 'مكتمل' : 'مفتوح'}
                      </span>
                    </td>
                    <td>
                      <button className="icon-button" onClick={(e) => { e.stopPropagation(); setSelectedVisit(visit); }} title="عرض التفاصيل">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showNewModal && (
        <VisitModal
          owners={owners}
          pets={pets}
          onClose={() => setShowNewModal(false)}
          onSaved={() => {
            setShowNewModal(false);
            setToast('تم حفظ الزيارة والروشتة بنجاح');
            void load();
            setTimeout(() => setToast(''), 2500);
          }}
        />
      )}

      {selectedVisit && (
        <VisitDetailsModal visit={selectedVisit} onClose={() => setSelectedVisit(null)} />
      )}
    </div>
  );
}

function VisitDetailsModal({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const navigate = useNavigate();

  function handlePrint() {
    window.print();
  }

  return (
    <Modal title={`السجل الطبي — ${visit.pet?.name}`} subtitle={`المالك: ${visit.pet?.owner?.fullName}`} onClose={onClose}>
      <div className="visit-details-content">
        <div className="visit-header-meta">
          <div><strong>سبب الزيارة:</strong> {visit.chiefComplaint}</div>
          <div><strong>التشخيص:</strong> {visit.diagnosis || 'غير محدد'}</div>
          <div><strong>الطبيب:</strong> {visit.vet?.fullName || '—'}</div>
          <div><strong>الحالة:</strong> <span className={`status ${visit.status === 'COMPLETED' ? 'green' : 'amber'}`}><i />{visit.status}</span></div>
        </div>

        {(visit.temperature || visit.weight || visit.heartRate || visit.respRate) && (
          <div className="form-section">
            <h4>العلامات الحيوية (Vitals)</h4>
            <div className="vitals-badges">
              {visit.temperature && <span><Thermometer size={14} /> الحرارة: {visit.temperature} °C</span>}
              {visit.weight && <span><Weight size={14} /> الوزن: {visit.weight} كجم</span>}
              {visit.heartRate && <span><HeartPulse size={14} /> النبض: {visit.heartRate} /د</span>}
              {visit.respRate && <span><Activity size={14} /> التنفس: {visit.respRate} /د</span>}
            </div>
          </div>
        )}

        <div className="form-section">
          <h4>ملاحظات الفحص والتشخيص</h4>
          <div className="soap-view-grid">
            <div className="soap-box"><b>التاريخ المرضي الشكوى</b><p>{visit.history || visit.chiefComplaint}</p></div>
            <div className="soap-box"><b>الفحص الإكلينيكي</b><p>{visit.physicalExam || 'سليم إكلينيكياً'}</p></div>
            <div className="soap-box"><b>التشخيص النهايئ</b><p>{visit.diagnosis}</p></div>
            <div className="soap-box"><b>الخطة والتوصيات</b><p>{visit.plan}</p></div>
          </div>
        </div>

        {visit.prescriptions && visit.prescriptions.length > 0 && (
          <div className="form-section">
            <h4>الوصفة الطبية (الروشتة)</h4>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>الدواء</th>
                  <th>الجرعة (محسوبة على الوزن)</th>
                  <th>التكرار</th>
                  <th>المدة</th>
                  <th>تعليمات</th>
                </tr>
              </thead>
              <tbody>
                {visit.prescriptions.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.medicine}</strong></td>
                    <td>{p.dosage}</td>
                    <td>{p.frequency || '—'}</td>
                    <td>{p.durationDays} أيام</td>
                    <td>{p.instructions || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Prescription Template */}
      <div className="printable-prescription">
        <header>
          <div>
            <h1>عيادة أليف البيطرية (قطط وكلاب)</h1>
            <p>روشتة وخطة علاجية بيطرية مخصصة</p>
          </div>
          <Stethoscope size={36} />
        </header>
        <div className="rx-meta">
          <span><b>التاريخ:</b> {new Date(visit.createdAt!).toLocaleDateString('ar-EG')}</span>
          <span><b>المالك:</b> {visit.pet?.owner?.fullName} ({visit.pet?.owner?.phone})</span>
          <span><b>الحيوان الأليف:</b> {visit.pet?.name} ({visit.pet?.species === 'CAT' ? 'قطة 🐱' : 'كلب 🐶'})</span>
          <span><b>الطبيب البيطري:</b> {visit.vet?.fullName}</span>
        </div>
        <div className="rx-body">
          <h3>التشخيص: {visit.diagnosis}</h3>
          <h4>الوصفة الطبية Rx</h4>
          <ul>
            {visit.prescriptions?.map((p) => (
              <li key={p.id}>
                <strong>{p.medicine}</strong> — الجرعة: {p.dosage} | {p.frequency} | لمدة: {p.durationDays} أيام
                {p.instructions && <small> ({p.instructions})</small>}
              </li>
            ))}
          </ul>
          {visit.plan && <p><b>التوصيات والنظام الغذائي:</b> {visit.plan}</p>}
          {visit.followUpAt && <p><b>موعد المتابعة القادم:</b> {new Date(visit.followUpAt).toLocaleDateString('ar-EG')}</p>}
        </div>
        <footer>عيادة أليف البيطرية • نتمنى لأليفكم الشفاء العاجل 🐾</footer>
      </div>

      <div className="modal-actions no-print">
        <button className="button secondary" onClick={onClose}>إغلاق</button>
        <button className="button secondary" onClick={() => navigate('/billing')}><ReceiptText size={16} /> إصدار فاتورة</button>
        <button className="button primary" onClick={handlePrint}><Printer size={16} /> طباعة الروشتة PDF</button>
      </div>
    </Modal>
  );
}

function VisitModal({ owners, pets, onClose, onSaved }: { owners: Owner[]; pets: Pet[]; onClose: () => void; onSaved: () => void }) {
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');
  const [petId, setPetId] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [history, setHistory] = useState('');
  const [temperature, setTemperature] = useState('');
  const [weight, setWeight] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respRate, setRespRate] = useState('');
  const [physicalExam, setPhysicalExam] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [plan, setPlan] = useState('');
  const [medicine, setMedicine] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [durationDays, setDurationDays] = useState('5');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const ownerPets = pets.filter((p) => p.ownerId === ownerId);

  useEffect(() => {
    const selectedPet = ownerPets[0];
    setPetId(selectedPet?.id ?? '');
    if (selectedPet?.weight) {
      setWeight(String(selectedPet.weight));
    }
  }, [ownerId]);

  // Auto calculate dosage recommendation when medicine or weight changes
  useEffect(() => {
    if (weight && medicine) {
      const w = Number(weight);
      if (medicine.includes('أموكسايسيلين')) {
        const mg = w * 12.5; // 12.5 mg/kg standard dose
        setDosage(`${mg.toFixed(0)} ملجم (${(mg / 50).toFixed(1)} قرص 50ملجم)`);
      } else if (medicine.includes('سيمباريكا') || medicine.includes('برودلاين')) {
        setDosage(`جرعة واحدة تناسب وزن ${w} كجم`);
      }
    }
  }, [weight, medicine]);

  async function submit() {
    setSaving(true);
    try {
      const prescriptions = medicine
        ? [{ medicine, dosage: dosage || 'حسب الإرشادات', frequency: frequency || 'مرتان يومياً', durationDays: Number(durationDays), instructions }]
        : [];

      await api('/visits', {
        method: 'POST',
        body: JSON.stringify({
          petId,
          chiefComplaint,
          history,
          temperature: temperature ? Number(temperature) : undefined,
          weight: weight ? Number(weight) : undefined,
          heartRate: heartRate ? Number(heartRate) : undefined,
          respRate: respRate ? Number(respRate) : undefined,
          physicalExam,
          diagnosis,
          plan,
          prescriptions,
        }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'تعذر حفظ الكشف الطبي');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="فتح كشف طبي جديد" subtitle="نموذج SOAP وحساب الجرعة طبقاً لوزن الحيوان" onClose={onClose}>
      <div className="medical-form">
        <div className="form-section">
          <h4>اختيار المريض</h4>
          <div className="form-grid compact">
            <label>المالك
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                {owners.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </select>
            </label>
            <label>الحيوان الأليف
              <select value={petId} onChange={(e) => setPetId(e.target.value)}>
                {ownerPets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.species === 'CAT' ? 'قطة 🐱' : 'كلب 🐶'})
                  </option>
                ))}
              </select>
            </label>
            <label className="full-span">الشكوى الرئيسية (Chief Complaint) *
              <input value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} required placeholder="سبب الحضور اليوم..." />
            </label>
          </div>
        </div>

        <div className="form-section">
          <h4>العلامات الحيوية (Vitals)</h4>
          <div className="vitals-grid">
            <label><Thermometer /> الحرارة °C<input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="38.5" /></label>
            <label><Weight /> الوزن كجم *<input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required placeholder="3.5" /></label>
            <label><HeartPulse /> النبض/د<input type="number" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} placeholder="120" /></label>
            <label><Activity /> التنفس/د<input type="number" value={respRate} onChange={(e) => setRespRate(e.target.value)} placeholder="24" /></label>
          </div>
        </div>

        <div className="form-section">
          <h4>التشخيص والروشتة (حساب الجرعة التلقائي)</h4>
          <div className="form-grid compact">
            <label className="full-span">التشخيص الطبي (Diagnosis) *
              <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} required placeholder="التشخيص الإكلينيكي..." />
            </label>
            <label className="full-span">خطة العلاج والتوصيات (Plan) *
              <textarea rows={2} value={plan} onChange={(e) => setPlan(e.target.value)} required placeholder="الخطة العلاجية والتغذية..." />
            </label>
            <label>اسم الدواء
              <input value={medicine} onChange={(e) => setMedicine(e.target.value)} placeholder="مثال: أموكسايسيلين 50 ملجم" />
            </label>
            <label>الجرعة المحسوبة
              <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="تحسب تلقائياً بوزن الحيوان" />
            </label>
            <label>التكرار
              <input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="مرتان يومياً" />
            </label>
            <label>المدة (أيام)
              <input type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </label>
          </div>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="modal-actions sticky">
        <button className="button primary" onClick={() => void submit()} disabled={saving || !petId || !chiefComplaint || !diagnosis || !plan}>
          {saving ? 'جارٍ الحفظ...' : 'حفظ الكشف وإصدار الروشتة'}
        </button>
        <button className="button secondary" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
