import { useEffect, useState } from 'react';
import { Award, Calendar, Check, AlertTriangle, Plus, Printer, Search, ShieldCheck, Syringe, PawPrint } from 'lucide-react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { Vaccination, Vaccine, Pet, Owner, Species } from '../types';

export function Vaccinations() {
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState<Vaccination | null>(null);
  const [toast, setToast] = useState('');

  async function load() {
    try {
      const [vData, vacData, oData, pData] = await Promise.all([
        api<Vaccination[]>('/vaccinations'),
        api<Vaccine[]>('/vaccines'),
        api<Owner[]>('/owners'),
        api<Pet[]>('/pets'),
      ]);
      setVaccinations(vData);
      setVaccines(vacData);
      setOwners(oData);
      setPets(pData);
    } catch (e: any) {
      console.error(e);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="page">
      <div className="page-heading no-print">
        <div>
          <span className="eyebrow">البروتوكولات الوقائية</span>
          <h2>سجل شهادات وتطعيمات القطط والكلاب 💉</h2>
          <p>إدارة اللقاحات المفصولة حسب النوع، إصدار الشهادات والتحقق الصارم من التوافق.</p>
        </div>
        <button className="button primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> تسجيل تطعيم جديد
        </button>
      </div>

      {toast && <div className="toast no-print"><Check size={17} />{toast}</div>}

      <div className="vaccination-banner no-print">
        <div>
          <span className="vaccination-hero-icon"><ShieldCheck size={28} /></span>
          <span>
            <strong>بروتوكول تحصين القطط والكلاب الصارم 🐾</strong>
            <small>حماية كاملة، منع صرف التلقيحات غير المطابقة للنوع أو المنتهية الصلاحية.</small>
          </span>
        </div>
      </div>

      <div className="vaccination-grid no-print">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>شهادات التطعيم المكتملة</h3>
              <p>سجل التطعيمات الممنوحة والشهادات الصادرة</p>
            </div>
          </div>
          <div className="vaccine-list">
            {vaccinations.length === 0 ? (
              <div className="empty-state"><Syringe size={26} /><p>لا توجد تطعيمات مسجلة بعد</p></div>
            ) : (
              vaccinations.map((vac) => (
                <article key={vac.id}>
                  <div className={`pet-avatar mini ${vac.pet?.species === 'CAT' ? 'cat' : 'dog'}`}>
                    <PawPrint size={14} />
                  </div>
                  <div>
                    <strong>{vac.pet?.name} — {vac.vaccine?.name} (جرعة #{vac.doseNumber})</strong>
                    <small>المالك: {vac.pet?.owner?.fullName} • الشهادة: {vac.certificateNo}</small>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <button className="button secondary mini" onClick={() => setSelectedCert(vac)}>
                      <Award size={13} /> طباعة الشهادة
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>كتالوج اللقاحات المتوفرة في المخزون</h3>
              <p>مفصولة ومخصصة للقطط أو الكلاب حصرًا</p>
            </div>
          </div>
          <div className="due-list">
            {vaccines.map((v) => (
              <article key={v.id}>
                <div>
                  <strong>{v.name} ({v.species === 'CAT' ? 'قطط 🐱' : 'كلاب 🐶'})</strong>
                  <small>الشركة: {v.manufacturer || 'عام'} • التشغيلة: {v.batchNo} • المتبقي: {v.stockQty} جرعة</small>
                </div>
                <div>
                  <span className={`tag ${new Date(v.expiryDate) < new Date() ? 'gray' : 'teal'}`}>
                    {v.price} ج.م
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {showModal && (
        <VaccinationModal
          owners={owners}
          pets={pets}
          vaccines={vaccines}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            setToast('تم تسجيل التطعيم وإصدار الشهادة');
            void load();
            setTimeout(() => setToast(''), 2500);
          }}
        />
      )}

      {selectedCert && (
        <CertificateModal cert={selectedCert} onClose={() => setSelectedCert(null)} />
      )}
    </div>
  );
}

function CertificateModal({ cert, onClose }: { cert: Vaccination; onClose: () => void }) {
  return (
    <Modal title={`شهادة تطعيم رسمية — ${cert.pet?.name}`} subtitle={`رقم الشهادة: ${cert.certificateNo}`} onClose={onClose}>
      <div className="printable-prescription" style={{ display: 'block' }}>
        <header style={{ borderColor: '#7d6cd5', color: '#5642a8' }}>
          <div>
            <h1>شهادة تطعيم بيطرية معتمدة 📜</h1>
            <p>عيادة أليف البيطرية للقطط والكلاب</p>
          </div>
          <Award size={36} />
        </header>

        <div className="rx-meta" style={{ background: '#f8f7fd', padding: '15px', borderRadius: '10px', margin: '15px 0' }}>
          <span><b>اسم الحيوان الأليف:</b> {cert.pet?.name}</span>
          <span><b>النوع:</b> {cert.pet?.species === 'CAT' ? 'قطة 🐱' : 'كلب 🐶'} ({cert.pet?.breed?.nameAr})</span>
          <span><b>رقم الشريحة (Microchip):</b> {cert.pet?.microchip || 'غير مسجل'}</span>
          <span><b>المالك:</b> {cert.pet?.owner?.fullName}</span>
          <span><b>الهاتف:</b> {cert.pet?.owner?.phone}</span>
          <span><b>اسم اللقاح المعطى:</b> {cert.vaccine?.name}</span>
          <span><b>رقم التشغيلة (Batch No):</b> {cert.vaccine?.batchNo}</span>
          <span><b>تاريخ التطعيم:</b> {new Date(cert.givenAt).toLocaleDateString('ar-EG')}</span>
          <span><b>موعد الجرعة التنشيطية:</b> {cert.nextDueAt ? new Date(cert.nextDueAt).toLocaleDateString('ar-EG') : 'سنوي'}</span>
          <span><b>الطبيب المعتمد:</b> {cert.givenBy?.fullName}</span>
        </div>

        <div style={{ textAlign: 'center', marginTop: '30px', borderTop: '1px dashed #ccc', paddingTop: '15px' }}>
          <p style={{ fontWeight: 700, color: '#334' }}>هذه الشهادة رسمية وموثقة بسجلات عيادة أليف البيطرية 🐾</p>
        </div>
      </div>

      <div className="modal-actions no-print">
        <button className="button secondary" onClick={onClose}>إغلاق</button>
        <button className="button primary" onClick={() => window.print()}><Printer size={16} /> طباعة الشهادة PDF</button>
      </div>
    </Modal>
  );
}

function VaccinationModal({
  owners,
  pets,
  vaccines,
  onClose,
  onSaved,
}: {
  owners: Owner[];
  pets: Pet[];
  vaccines: Vaccine[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');
  const [petId, setPetId] = useState('');
  const [vaccineId, setVaccineId] = useState('');
  const [doseNumber, setDoseNumber] = useState('1');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const ownerPets = pets.filter((p) => p.ownerId === ownerId);
  const selectedPet = pets.find((p) => p.id === petId);

  // Filter vaccines to ONLY show matching species (CAT vs DOG)
  const matchingVaccines = vaccines.filter((v) => !selectedPet || v.species === selectedPet.species);

  useEffect(() => {
    setPetId(ownerPets[0]?.id ?? '');
  }, [ownerId]);

  useEffect(() => {
    setVaccineId(matchingVaccines[0]?.id ?? '');
  }, [petId]);

  async function submit() {
    if (!selectedPet) return;

    const selectedVaccine = vaccines.find((v) => v.id === vaccineId);
    if (selectedVaccine && selectedVaccine.species !== selectedPet.species) {
      setError('خطأ: لا يمكن إعطاء لقاح مخصص لنوع آخر!');
      return;
    }

    setSaving(true);
    try {
      await api('/vaccinations', {
        method: 'POST',
        body: JSON.stringify({
          petId,
          vaccineId,
          doseNumber: Number(doseNumber),
        }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'تعذر تسجيل التطعيم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="تسجيل تطعيم جديد" subtitle="التحقق من مطابقة نوع الحيوان وصلاحية اللقاح" onClose={onClose}>
      <div className="form-grid">
        <label className="full-span">المالك *
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {owners.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </select>
        </label>

        <label className="full-span">الحيوان الأليف *
          <select value={petId} onChange={(e) => setPetId(e.target.value)}>
            {ownerPets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.species === 'CAT' ? 'قطة 🐱' : 'كلب 🐶'})
              </option>
            ))}
          </select>
        </label>

        {selectedPet && (
          <div className="full-span" style={{ padding: '10px 14px', borderRadius: '8px', background: '#eef8f5', fontSize: '11px', color: '#0f766e', border: '1px solid #c9ece5' }}>
            اللقاحات المتوفرة والمطابقة لـ <strong>{selectedPet.species === 'CAT' ? 'القطط 🐱' : 'الكلاب 🐶'}</strong> فقط:
          </div>
        )}

        <label className="full-span">اللقاح المطابق لنوع الحيوان *
          <select value={vaccineId} onChange={(e) => setVaccineId(e.target.value)}>
            {matchingVaccines.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — التشغيلة: {v.batchNo} ({v.stockQty} متبقي)
              </option>
            ))}
          </select>
        </label>

        <label>رقم الجرعة
          <select value={doseNumber} onChange={(e) => setDoseNumber(e.target.value)}>
            <option value="1">الجرعة الأولى (#1)</option>
            <option value="2">الجرعة الثانية (#2)</option>
            <option value="3">الجرعة الثالثة (#3)</option>
            <option value="4">جرعة تنشيطية سنوية</option>
          </select>
        </label>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="modal-actions">
        <button className="button primary" onClick={() => void submit()} disabled={saving || !petId || !vaccineId}>
          {saving ? 'جارٍ تسجيل التطعيم...' : 'صرف اللقاح وإصدار الشهادة'}
        </button>
        <button className="button secondary" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
