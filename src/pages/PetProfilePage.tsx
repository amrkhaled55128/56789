import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PawPrint, Calendar, User as UserIcon, Phone, ShieldCheck, Activity, Stethoscope, Syringe, FileText, Scale, Plus } from 'lucide-react';
import { api } from '../api';
import type { Pet } from '../types';

export function PetProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'visits' | 'vaccines' | 'weight'>('timeline');

  async function loadPet() {
    if (!id) return;
    setLoading(true);
    try {
      setError('');
      const data = await api<Pet>(`/pets/${id}`);
      setPet(data);
    } catch (err: any) {
      setError(err.message || 'تعذر فتح الملف الطبي للحيوان');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPet();
  }, [id]);

  if (loading) {
    return <div className="page"><p>جاري تحميل الملف الطبي للحيوان...</p></div>;
  }

  if (error || !pet) {
    return (
      <div className="page">
        <div className="alert error">{error || 'الملف الطبي غير موجود'}</div>
        <button className="button secondary" onClick={() => navigate('/clients')}>العودة للعملاء</button>
      </div>
    );
  }

  const ageYears = pet.birthDate
    ? Math.floor((new Date().getTime() - new Date(pet.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div className="pet-profile-page page">
      {/* Top Pet Profile Card Header */}
      <div className="panel" style={{ padding: '24px', marginBottom: '20px', background: 'linear-gradient(135deg, #ffffff 0%, #f6fcfb 100%)' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className={`pet-avatar ${pet.species === 'CAT' ? 'cat' : 'dog'}`} style={{ width: '70px', height: '70px', fontSize: '32px' }}>
            {pet.species === 'CAT' ? '🐱' : '🐶'}
          </div>

          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '24px' }}>{pet.name}</h2>
              <span className={`tag ${pet.species === 'CAT' ? 'teal' : 'purple'}`}>
                {pet.species === 'CAT' ? 'قطة (CAT)' : 'كلب (DOG)'}
              </span>
              {pet.isNeutered && <span className="tag gray">متعقم</span>}
            </div>

            <p style={{ margin: '6px 0 0', color: '#687b7e', fontSize: '13px' }}>
              السلالة: <strong>{pet.breed?.nameAr || 'غير محددة'}</strong> • الجنس: <strong>{pet.sex === 'FEMALE' ? 'أنثى' : 'ذكر'}</strong> • العمر: <strong>{ageYears !== null ? `${ageYears} سنة` : 'غير مدون'}</strong> • الوزن: <strong>{pet.weight ? `${pet.weight} كجم` : '--'}</strong>
            </p>
          </div>

          <div style={{ padding: '12px 18px', background: '#eef8f5', borderRadius: '10px', border: '1px solid #c9ece5', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0f766e' }}>
              <UserIcon size={15} /> المالك: {pet.owner?.fullName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#557073', marginTop: '4px' }}>
              <Phone size={13} /> {pet.owner?.phone}
            </div>
          </div>
        </div>

        {/* Microchip & Vitals bar */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #edf4f3', fontSize: '12px', color: '#5b6f72' }}>
          <div>رقم الشريحة: <strong>{pet.microchip || 'لا يـوجد'}</strong></div>
          <div>الحساسية: <strong>{pet.allergies || 'لا يـوجد'}</strong></div>
          <div>الأمراض المزمنة: <strong>{pet.chronicDiseases || 'لا يـوجد'}</strong></div>
          <div>النظام الغذائي: <strong>{pet.diet || 'طبيعي'}</strong></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="segmented" style={{ marginBottom: '16px', display: 'inline-flex' }}>
        <button className={activeTab === 'timeline' ? 'selected' : ''} onClick={() => setActiveTab('timeline')}>
          الخط الزمني الطبي
        </button>
        <button className={activeTab === 'visits' ? 'selected' : ''} onClick={() => setActiveTab('visits')}>
          الكشوفات والروشتات ({pet.visits?.length || 0})
        </button>
        <button className={activeTab === 'vaccines' ? 'selected' : ''} onClick={() => setActiveTab('vaccines')}>
          التطعيمات ({pet.vaccinations?.length || 0})
        </button>
        <button className={activeTab === 'weight' ? 'selected' : ''} onClick={() => setActiveTab('weight')}>
          منحنى تغيير الوزن
        </button>
      </div>

      {/* Content based on Active Tab */}
      {activeTab === 'timeline' && (
        <div className="panel" style={{ padding: '20px' }}>
          <h3>الخط الزمني الطبي الكامل (Medical Timeline)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
            {pet.visits && pet.visits.map((v) => (
              <div key={v.id} style={{ padding: '12px 16px', borderRight: '4px solid #0f766e', background: '#fafdfc', border: '1px solid #e7f2f0', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 }}>
                  <span>🩺 كشف طبي - {v.chiefComplaint}</span>
                  <time>{new Date(v.createdAt!).toLocaleDateString('ar-EG')}</time>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#4a5d60' }}>
                  التشخيص: {v.diagnosis} • الخطـة: {v.plan}
                </p>
              </div>
            ))}

            {pet.vaccinations && pet.vaccinations.map((vac) => (
              <div key={vac.id} style={{ padding: '12px 16px', borderRight: '4px solid #7d6cd5', background: '#faf9fe', border: '1px solid #ece8fa', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 }}>
                  <span>💉 تطعيم: {vac.vaccine?.name} (جرعة #{vac.doseNumber})</span>
                  <time>{new Date(vac.givenAt).toLocaleDateString('ar-EG')}</time>
                </div>
                <small style={{ color: '#6859b8' }}>شهادة رقم: {vac.certificateNo || 'بدون'} • المستحق القادم: {vac.nextDueAt ? new Date(vac.nextDueAt).toLocaleDateString('ar-EG') : 'غير محدد'}</small>
              </div>
            ))}

            {(!pet.visits || pet.visits.length === 0) && (!pet.vaccinations || pet.vaccinations.length === 0) && (
              <p className="muted">لا توجد سجلات بعد لهذا الحيوان</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'visits' && (
        <div className="panel" style={{ padding: '20px' }}>
          <h3>الكشوفات والسجل الطبي (SOAP)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '15px' }}>
            {pet.visits?.map((v) => (
              <div key={v.id} style={{ padding: '16px', border: '1px solid #e1eeeb', borderRadius: '10px', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <strong>الزيارة بتاريخ: {new Date(v.createdAt!).toLocaleDateString('ar-EG')}</strong>
                  <span className="tag teal">طبيب: {v.vet?.fullName}</span>
                </div>

                <div className="soap-view-grid">
                  <div className="soap-box"><b>S (Subjective) - الشكوى:</b><p>{v.chiefComplaint}</p></div>
                  <div className="soap-box"><b>O (Objective) - الفحص العلامات:</b><p>حرارة: {v.temperature || '--'}°C | وزن: {v.weight || '--'} كجم | نبض: {v.heartRate || '--'}</p></div>
                  <div className="soap-box"><b>A (Assessment) - التشخيص:</b><p>{v.diagnosis}</p></div>
                  <div className="soap-box"><b>P (Plan) - الخطة العلاجية:</b><p>{v.plan}</p></div>
                </div>

                {v.prescriptions && v.prescriptions.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #ddd' }}>
                    <strong style={{ fontSize: '12px', color: '#0f766e' }}>💊 الروشتة الطبية:</strong>
                    <table className="mini-table">
                      <thead>
                        <tr>
                          <th>الدواء</th>
                          <th>الجرعة (محسوبة على الوزن)</th>
                          <th>التكرار</th>
                          <th>المدة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.prescriptions.map((rx) => (
                          <tr key={rx.id}>
                            <td>{rx.medicine}</td>
                            <td>{rx.dosage}</td>
                            <td>{rx.frequency}</td>
                            <td>{rx.durationDays} أيام</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'vaccines' && (
        <div className="panel" style={{ padding: '20px' }}>
          <h3>كتالوج وشهادات التطعيم الخاصة بـ ({pet.species === 'CAT' ? 'القطط' : 'الكلاب'})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
            {pet.vaccinations?.map((vac) => (
              <div key={vac.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', border: '1px solid #e2ece9', borderRadius: '10px' }}>
                <div>
                  <strong style={{ fontSize: '14px', color: '#0f766e' }}>{vac.vaccine?.name}</strong>
                  <div style={{ fontSize: '11px', color: '#667', marginTop: '3px' }}>
                    رقم الشهادة: <strong>{vac.certificateNo}</strong> • الطبيب المعالج: {vac.givenBy?.fullName}
                  </div>
                </div>
                <div style={{ textAlign: 'left', fontSize: '12px' }}>
                  <div>تم الإعطاء: {new Date(vac.givenAt).toLocaleDateString('ar-EG')}</div>
                  <div style={{ color: '#d07e2f', fontWeight: 700, marginTop: '2px' }}>
                    الجرعة التنشيطية: {vac.nextDueAt ? new Date(vac.nextDueAt).toLocaleDateString('ar-EG') : 'سنوي'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'weight' && (
        <div className="panel" style={{ padding: '20px' }}>
          <h3>تغير وتتبع الوزن عبر الزيارات ⚖️</h3>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '15px' }}>
            {pet.weightHistory?.map((w, idx) => (
              <div key={idx} style={{ padding: '12px 20px', border: '1px solid #cce8e2', borderRadius: '10px', background: '#eef8f6', textAlign: 'center' }}>
                <strong style={{ fontSize: '18px', color: '#0f766e' }}>{w.weight} كجم</strong>
                <small style={{ display: 'block', color: '#557' }}>{w.date}</small>
              </div>
            ))}
            {(!pet.weightHistory || pet.weightHistory.length === 0) && (
              <p className="muted">لا تتوافر قراءات وزن تاريخية متسلسلة لهذا الحيوان بعد</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
