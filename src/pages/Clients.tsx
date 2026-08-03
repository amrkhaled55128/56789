import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, PawPrint, Phone, Mail, MapPin, Edit3, Eye, FileText, Activity } from 'lucide-react';
import { api } from '../api';
import type { Owner, Breed, Species, Sex } from '../types';
import { Modal } from '../components/Modal';

export function Clients() {
  const navigate = useNavigate();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [showAddPet, setShowAddPet] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');

  // New Owner Form
  const [ownerForm, setOwnerForm] = useState({
    fullName: '',
    phone: '',
    altPhone: '',
    email: '',
    address: '',
    nationalId: '',
    notes: '',
  });

  // New Pet Form (strictly CAT / DOG)
  const [petForm, setPetForm] = useState({
    name: '',
    species: 'CAT' as Species,
    breedId: '',
    sex: 'FEMALE' as Sex,
    birthDate: new Date().toISOString().split('T')[0],
    color: '',
    weight: '',
    microchip: '',
    isNeutered: false,
    allergies: '',
    chronicDiseases: '',
    diet: '',
  });

  async function loadOwners() {
    setLoading(true);
    try {
      setError('');
      const data = await api<Owner[]>(`/owners?query=${encodeURIComponent(search)}`);
      setOwners(data);
    } catch (e: any) {
      setError(e.message || 'تعذر تحميل قائمة العملاء');
    } finally {
      setLoading(false);
    }
  }

  async function loadBreeds() {
    try {
      const data = await api<Breed[]>('/breeds');
      setBreeds(data);
    } catch (e) {}
  }

  useEffect(() => {
    loadOwners();
    loadBreeds();
  }, [search]);

  async function handleCreateOwner(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/owners', {
        method: 'POST',
        body: JSON.stringify(ownerForm),
      });
      setShowAddOwner(false);
      setOwnerForm({ fullName: '', phone: '', altPhone: '', email: '', address: '', nationalId: '', notes: '' });
      loadOwners();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleCreatePet(e: React.FormEvent) {
    e.preventDefault();
    if (petForm.species !== 'CAT' && petForm.species !== 'DOG') {
      alert('يُسمح فقط بالقطط والكلاب!');
      return;
    }
    try {
      await api('/pets', {
        method: 'POST',
        body: JSON.stringify({
          ...petForm,
          ownerId: selectedOwnerId,
          weight: petForm.weight ? Number(petForm.weight) : undefined,
        }),
      });
      setShowAddPet(false);
      setPetForm({
        name: '',
        species: 'CAT',
        breedId: '',
        sex: 'FEMALE',
        birthDate: new Date().toISOString().split('T')[0],
        color: '',
        weight: '',
        microchip: '',
        isNeutered: false,
        allergies: '',
        chronicDiseases: '',
        diet: '',
      });
      loadOwners();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const filteredBreeds = breeds.filter((b) => b.species === petForm.species);

  return (
    <div className="clients-page page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">سجل العملاء والمرضى</span>
          <h2>إدارة العملاء والحيوانات الأليفة 🐾</h2>
          <p>بحث وإضافة وتتبع الملفات الطبية الشاملة للقطط والكلاب فقط.</p>
        </div>
        <div className="heading-actions">
          <button className="button primary" onClick={() => setShowAddOwner(true)}>
            <Plus size={18} /> إضافة عميل جديد
          </button>
        </div>
      </div>

      <div className="toolbar">
        <label className="table-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، هاتف العميل، أو رقم الشريحة..."
          />
        </label>
        <span className="muted">إجمالي العملاء: {owners.length}</span>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="panel table-panel">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>اسم العميل</th>
                <th>الهاتف الرئيسي / البديل</th>
                <th>العنوان</th>
                <th>الحيوانات المسجلة (قطط/كلاب)</th>
                <th>الرصيد/المستحقات</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((owner) => (
                <tr key={owner.id}>
                  <td>
                    <div className="client-cell">
                      <span className="avatar light">{owner.fullName.slice(0, 1)}</span>
                      <span>
                        <strong>{owner.fullName}</strong>
                        <small>{owner.email || 'بدون بريد'}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="contact-cell">
                      <span><Phone size={12} /> {owner.phone}</span>
                      {owner.altPhone && <small>بديل: {owner.altPhone}</small>}
                    </div>
                  </td>
                  <td>{owner.address || 'غير محدد'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {owner.pets && owner.pets.length > 0 ? (
                        owner.pets.map((pet) => (
                          <span
                            key={pet.id}
                            className={`tag ${pet.species === 'CAT' ? 'teal' : 'purple'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/pets/${pet.id}`)}
                            title="عرض الملف الطبي الكامل"
                          >
                            {pet.species === 'CAT' ? '🐱' : '🐶'} {pet.name}
                          </span>
                        ))
                      ) : (
                        <small className="muted">لا توجد حيوانات</small>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={Number(owner.balance) > 0 ? 'debt' : 'paid'}>
                      {Number(owner.balance)} ج.م
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="button secondary mini"
                        onClick={() => {
                          setSelectedOwnerId(owner.id);
                          setShowAddPet(true);
                        }}
                      >
                        <Plus size={13} /> إضافة حيوان
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {owners.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="table-message">
                    <Users size={24} />
                    <p>لا يوجد عملاء مطبقون لشرط البحث</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Owner */}
      {showAddOwner && (
        <Modal title="إضافة عميل جديد" onClose={() => setShowAddOwner(false)}>
          <form onSubmit={handleCreateOwner}>
            <div className="form-grid">
              <label>
                <span>الاسم بالكامل *</span>
                <input
                  type="text"
                  value={ownerForm.fullName}
                  onChange={(e) => setOwnerForm({ ...ownerForm, fullName: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>رقم الهاتف الرئيسي *</span>
                <input
                  type="tel"
                  value={ownerForm.phone}
                  onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>رقم الهاتف البديل</span>
                <input
                  type="tel"
                  value={ownerForm.altPhone}
                  onChange={(e) => setOwnerForm({ ...ownerForm, altPhone: e.target.value })}
                />
              </label>

              <label>
                <span>البريد الإلكتروني</span>
                <input
                  type="email"
                  value={ownerForm.email}
                  onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
                />
              </label>

              <label className="full-span">
                <span>العنوان السكني</span>
                <input
                  type="text"
                  value={ownerForm.address}
                  onChange={(e) => setOwnerForm({ ...ownerForm, address: e.target.value })}
                />
              </label>

              <label className="full-span">
                <span>ملاحظات خاصة</span>
                <textarea
                  rows={2}
                  value={ownerForm.notes}
                  onChange={(e) => setOwnerForm({ ...ownerForm, notes: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="submit" className="button primary">حفظ العميل</button>
              <button type="button" className="button secondary" onClick={() => setShowAddOwner(false)}>إلغاء</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Add Pet (CAT / DOG strictly) */}
      {showAddPet && (
        <Modal title="إضافة حيوان أليف جديد (قطط وكلاب فقط)" onClose={() => setShowAddPet(false)}>
          <form onSubmit={handleCreatePet}>
            <div className="form-grid">
              <label>
                <span>اسم الحيوان الأليف *</span>
                <input
                  type="text"
                  value={petForm.name}
                  onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>النوع الصارم * (CAT أو DOG فقط)</span>
                <select
                  value={petForm.species}
                  onChange={(e) => setPetForm({ ...petForm, species: e.target.value as Species, breedId: '' })}
                  required
                >
                  <option value="CAT">قطة 🐱 (CAT)</option>
                  <option value="DOG">كلب 🐶 (DOG)</option>
                </select>
              </label>

              <label>
                <span>السلالة (Breed)</span>
                <select
                  value={petForm.breedId}
                  onChange={(e) => setPetForm({ ...petForm, breedId: e.target.value })}
                >
                  <option value="">اختر السلالة من الكتالوج...</option>
                  {filteredBreeds.map((b) => (
                    <option key={b.id} value={b.id}>{b.nameAr} ({b.nameEn})</option>
                  ))}
                </select>
              </label>

              <label>
                <span>الجنس *</span>
                <select
                  value={petForm.sex}
                  onChange={(e) => setPetForm({ ...petForm, sex: e.target.value as Sex })}
                >
                  <option value="FEMALE">أنثى (Female)</option>
                  <option value="MALE">ذكر (Male)</option>
                </select>
              </label>

              <label>
                <span>تاريخ الميلاد</span>
                <input
                  type="date"
                  value={petForm.birthDate}
                  onChange={(e) => setPetForm({ ...petForm, birthDate: e.target.value })}
                />
              </label>

              <label>
                <span>الوزن الحاقي (كجم)</span>
                <input
                  type="number"
                  step="0.1"
                  value={petForm.weight}
                  onChange={(e) => setPetForm({ ...petForm, weight: e.target.value })}
                />
              </label>

              <label>
                <span>رقم الشريحة (Microchip)</span>
                <input
                  type="text"
                  value={petForm.microchip}
                  onChange={(e) => setPetForm({ ...petForm, microchip: e.target.value })}
                  placeholder="رقم فريد للشريحة الدقيقة"
                />
              </label>

              <label className="checkbox-label full-span">
                <input
                  type="checkbox"
                  checked={petForm.isNeutered}
                  onChange={(e) => setPetForm({ ...petForm, isNeutered: e.target.checked })}
                />
                <span>الحيوان متعقم (Neutered / Spayed)</span>
              </label>

              <label className="full-span">
                <span>الحساسية المعروفة (Allergies)</span>
                <input
                  type="text"
                  value={petForm.allergies}
                  onChange={(e) => setPetForm({ ...petForm, allergies: e.target.value })}
                  placeholder="حساسية من دواء أو طعام معين"
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="submit" className="button primary">إضافة للملف الطبي</button>
              <button type="button" className="button secondary" onClick={() => setShowAddPet(false)}>إلغاء</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
