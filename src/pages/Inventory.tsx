import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Boxes, CalendarClock, History, MoreHorizontal, PackageOpen, Plus, Search, ShoppingCart, TrendingDown } from 'lucide-react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { Product } from '../types';

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'product' | 'movement' | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [toast, setToast] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api<Product[]>('/inventory');
      setProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = products.filter((product) =>
    `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(search.toLowerCase())
  );
  const lowStock = products.filter((product) => product.stockQty <= product.reorderLevel);
  const totalValue = products.reduce((sum, p) => sum + p.stockQty * Number(p.sellPrice), 0);

  function saved(message: string) {
    setModal(null);
    setSelected(null);
    setToast(message);
    void load();
    setTimeout(() => setToast(''), 2500);
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">إدارة المخزون والصيدلية</span>
          <h2>الصيدلية والمستلزمات البيطرية 💊</h2>
          <p>متابعة رصيد الأدوية والتطعيمات والمستهلكات وحركات الدخول والخروج (Stock Movement).</p>
        </div>
        <div className="heading-actions">
          <button className="button secondary" onClick={() => setModal('movement')}>
            <ShoppingCart size={17} /> حركة / تسوية مخزون
          </button>
          <button className="button primary" onClick={() => setModal('product')}>
            <Plus size={18} /> إضافة صنف جديد
          </button>
        </div>
      </div>

      {toast && <div className="toast">✓ {toast}</div>}

      <section className="inventory-metrics">
        <div>
          <span className="inventory-icon teal"><Boxes /></span>
          <span><small>إجمالي الأصناف المسجلة</small><strong>{products.length}</strong></span>
        </div>
        <div>
          <span className="inventory-icon amber"><AlertTriangle /></span>
          <span><small>أصناف منخفضة (تحت حد الطلب)</small><strong>{lowStock.length}</strong></span>
        </div>
        <div>
          <span className="inventory-icon purple"><BarChart3 /></span>
          <span><small>القيمة الإجمالية للمخزون</small><strong>{totalValue.toLocaleString('ar-EG')} ج.م</strong></span>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h3>الأصناف والمنتجات</h3>
            <p>تتبع الأدوية والمستلزمات والحد الأدنى</p>
          </div>
          <label className="table-search">
            <Search size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم الصنف أو الكود SKU..." />
          </label>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>الصنف والوحدة</th>
                <th>التصنيف</th>
                <th>كود SKU</th>
                <th>الرصيد الحالي</th>
                <th>سعر التكلفة</th>
                <th>سعر البيع</th>
                <th>تاريخ الصلاحية</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="table-message">جارٍ تحميل المخزون...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-message">
                    <PackageOpen size={27} />
                    <p>لا توجد أصناف مطابقة للبحث</p>
                  </td>
                </tr>
              ) : (
                filtered.map((product) => {
                  const isLow = product.stockQty <= product.reorderLevel;
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="product-cell">
                          <span className="product-icon"><PackageOpen size={17} /></span>
                          <span>
                            <strong>{product.name}</strong>
                            <small>{product.unit}</small>
                          </span>
                        </div>
                      </td>
                      <td><span className="tag gray">{product.category}</span></td>
                      <td className="mono">{product.sku}</td>
                      <td>
                        <button
                          className={`stock-value stock-button ${isLow ? 'low' : ''}`}
                          onClick={() => { setSelected(product); setModal('movement'); }}
                        >
                          {product.stockQty} {product.unit} {isLow && <TrendingDown size={14} />}
                        </button>
                      </td>
                      <td>{Number(product.costPrice).toLocaleString('ar-EG')} ج.م</td>
                      <td><strong>{Number(product.sellPrice).toLocaleString('ar-EG')} ج.م</strong></td>
                      <td>{product.expiryDate ? new Date(product.expiryDate).toLocaleDateString('ar-EG') : '—'}</td>
                      <td>
                        <button className="button secondary mini" onClick={() => { setSelected(product); setModal('movement'); }}>
                          تسوية
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal === 'product' && <ProductModal onClose={() => setModal(null)} onSaved={() => saved('تمت إضافة الصنف بنجاح')} />}
      {modal === 'movement' && <StockMovementModal products={products} selected={selected} onClose={() => { setModal(null); setSelected(null); }} onSaved={() => saved('تم تسجيل حركة المخزون وتحديد الرصيد')} />}
    </div>
  );
}

function ProductModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [sku, setSku] = useState(`SKU-${Date.now().toString().slice(-5)}`);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('MEDICINE');
  const [unit, setUnit] = useState('علبة');
  const [costPrice, setCostPrice] = useState('50');
  const [sellPrice, setSellPrice] = useState('80');
  const [stockQty, setStockQty] = useState('20');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    try {
      await api('/inventory', {
        method: 'POST',
        body: JSON.stringify({
          sku,
          name,
          category,
          unit,
          costPrice: Number(costPrice),
          sellPrice: Number(sellPrice),
          stockQty: Number(stockQty),
          reorderLevel: Number(reorderLevel),
          expiryDate: expiryDate || undefined,
        }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'تعذر إضافة الصنف');
    }
  }

  return (
    <Modal title="إضافة صنف مخزني جديد" subtitle="أدوية ومستلزمات ومستهلكات بيطرية" onClose={onClose}>
      <div className="form-grid">
        <label>كود SKU / الباركود *
          <input value={sku} onChange={(e) => setSku(e.target.value)} required />
        </label>
        <label>اسم الصنف *
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="مثال: حقن معقمة أو مضاد حيوي" />
        </label>
        <label>التصنيف *
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="MEDICINE">أدوية وعلاجات (MEDICINE)</option>
            <option value="VACCINE">تطعيمات ولقاحات (VACCINE)</option>
            <option value="CONSUMABLE">مستهلكات طبية (CONSUMABLE)</option>
            <option value="FOOD">أغذية وطعام قطط/كلاب (FOOD)</option>
            <option value="SERVICE">خدمات وكشوفات (SERVICE)</option>
          </select>
        </label>
        <label>الوحدة *
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="شريط / علبة / أنبوبة" />
        </label>
        <label>سعر التكلفة (ج.م)
          <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
        </label>
        <label>سعر البيع للعميل (ج.م) *
          <input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} required />
        </label>
        <label>الرصيد الافتتاحي *
          <input type="number" value={stockQty} onChange={(e) => setStockQty(e.target.value)} required />
        </label>
        <label>حد إعادة الطلب
          <input type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
        </label>
        <label>تاريخ الصلاحية
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <button className="button primary" onClick={() => void submit()} disabled={!sku || !name}>حفظ الصنف</button>
        <button className="button secondary" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}

function StockMovementModal({ products, selected, onClose, onSaved }: { products: Product[]; selected: Product | null; onClose: () => void; onSaved: () => void }) {
  const [productId, setProductId] = useState(selected?.id ?? products[0]?.id ?? '');
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [quantity, setQuantity] = useState('10');
  const [reason, setReason] = useState('إضافة توريد جديد للمخزن');
  const [error, setError] = useState('');

  async function submit() {
    try {
      await api('/inventory/movement', {
        method: 'POST',
        body: JSON.stringify({ productId, type, quantity: Number(quantity), reason }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'تعذر تسوية المخزون');
    }
  }

  return (
    <Modal title="تسجيل حركة مخزون (Stock Movement)" subtitle="تسجيل دخول توريد أو إضافة أو تسوية عجز" onClose={onClose}>
      <div className="form-grid">
        <label className="full-span">الصنف *
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option value={p.id} key={p.id}>{p.name} — الرصيد الحالي: {p.stockQty} {p.unit}</option>
            ))}
          </select>
        </label>

        <label>نوع الحركة *
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="IN">إدخال توريد (+ IN)</option>
            <option value="OUT">صرف / فاقد (- OUT)</option>
            <option value="ADJUST">تسوية جرد مباشر (= ADJUST)</option>
          </select>
        </label>

        <label>الكمية *
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </label>

        <label className="full-span">السبب / الملاحظات *
          <input value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="رقم فاتورة المورد أو السبب..." />
        </label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <button className="button primary" onClick={() => void submit()} disabled={!productId || !quantity || !reason}>تأكيد الحركة</button>
        <button className="button secondary" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
