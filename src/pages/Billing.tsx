import { useEffect, useMemo, useState } from 'react';
import { Banknote, Calendar, CircleDollarSign, Plus, Printer, ReceiptText, Search, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { Owner, Invoice, InvoiceItem, Pet, Product } from '../types';

type DraftItem = { productId?: string; description: string; quantity: number; unitPrice: number };

export function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [show, setShow] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [printData, setPrintData] = useState<Invoice | null>(null);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    try {
      const [i, o, p, pr] = await Promise.all([
        api<Invoice[]>('/invoices'),
        api<Owner[]>('/owners'),
        api<Pet[]>('/pets'),
        api<Product[]>('/inventory'),
      ]);
      setInvoices(i);
      setOwners(o);
      setPets(p);
      setProducts(pr);
    } catch (e: any) {
      console.error(e);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => ({
    billed: invoices.reduce((s, i) => s + Number(i.total), 0),
    paid: invoices.reduce((s, i) => s + Number(i.paid), 0),
    due: invoices.reduce((s, i) => s + (Number(i.total) - Number(i.paid)), 0),
  }), [invoices]);

  async function handlePrint(invoice: Invoice) {
    const details = await api<Invoice>(`/invoices/${invoice.id}`);
    setPrintData(details);
    setTimeout(() => window.print(), 150);
  }

  const filteredInvoices = invoices.filter((inv) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      inv.invoiceNo.toLowerCase().includes(s) ||
      inv.owner?.fullName.toLowerCase().includes(s) ||
      inv.owner?.phone.includes(s)
    );
  });

  return (
    <div className="page billing-page">
      <div className="page-heading no-print">
        <div>
          <span className="eyebrow">الحسابات والعمليات المالية</span>
          <h2>الفواتير والمدفوعات 💳</h2>
          <p>إصدار الفواتير المتعددة البنود، خصم المخزون التلقائي بالسحب من Transaction وإدارة المستحقات.</p>
        </div>
        <div className="heading-actions" style={{ alignItems: 'center' }}>
          <button className="button primary" onClick={() => setShow(true)}>
            <Plus size={18} /> + فاتورة جديدة
          </button>
        </div>
      </div>

      {toast && <div className="toast no-print">✓ {toast}</div>}

      <section className="billing-summary no-print">
        <div>
          <span className="billing-icon teal"><ReceiptText /></span>
          <span><small>إجمالي الفواتير الصادرة</small><strong>{totals.billed.toLocaleString('ar-EG')} ج.م</strong></span>
        </div>
        <div>
          <span className="billing-icon green"><Banknote /></span>
          <span><small>تم تحصيله نقدياً</small><strong>{totals.paid.toLocaleString('ar-EG')} ج.م</strong></span>
        </div>
        <div>
          <span className="billing-icon amber"><CircleDollarSign /></span>
          <span><small>رصيد مستحق على العملاء</small><strong>{totals.due.toLocaleString('ar-EG')} ج.م</strong></span>
        </div>
      </section>

      <section className="panel table-panel no-print">
        <div className="panel-header">
          <div>
            <h3>سجل الفواتير الصادرة</h3>
            <p>{filteredInvoices.length} فاتورة مسجلة</p>
          </div>
          <label className="table-search">
            <Search size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث برقم الفاتورة، اسم المالك، أو الهاتف..." />
          </label>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>المالك والعميل</th>
                <th>الحيوان الأليف</th>
                <th>الإجمالي</th>
                <th>المدفوع</th>
                <th>الحالة</th>
                <th>طباعة</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan={7} className="table-message"><ReceiptText size={26} /> لا توجد فواتير مطابقة للبحث</td></tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="mono"><strong>{invoice.invoiceNo}</strong></td>
                    <td>
                      <strong>{invoice.owner?.fullName}</strong>
                      <small className="block muted">{invoice.owner?.phone}</small>
                    </td>
                    <td>{invoice.pet ? <span className="tag gray">🐾 {invoice.pet.name}</span> : <span className="muted">—</span>}</td>
                    <td><strong>{Number(invoice.total).toLocaleString('ar-EG')} ج.م</strong></td>
                    <td>{Number(invoice.paid).toLocaleString('ar-EG')} ج.م</td>
                    <td>
                      <button
                        className={`status status-button ${invoice.status === 'PAID' ? 'green' : invoice.status === 'PARTIAL' ? 'amber' : 'red'}`}
                        onClick={() => invoice.status !== 'PAID' && setPaymentInvoice(invoice)}
                      >
                        <i />{invoice.status === 'PAID' ? 'مدفوعة' : invoice.status === 'PARTIAL' ? 'مدفوعة جزئياً' : 'غير مدفوعة'}
                      </button>
                    </td>
                    <td>
                      <button className="icon-button" title="طباعة الفاتورة" onClick={() => void handlePrint(invoice)}>
                        <Printer size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {show && (
        <InvoiceModal
          owners={owners}
          pets={pets}
          products={products}
          onClose={() => setShow(false)}
          onSaved={() => {
            setShow(false);
            setToast('تم إصدار الفاتورة وتحديث رصيد المخزون تلقائياً');
            void load();
            setTimeout(() => setToast(''), 2700);
          }}
        />
      )}

      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSaved={() => {
            setPaymentInvoice(null);
            setToast('تم تحصيل الدفعة بنجاح');
            void load();
            setTimeout(() => setToast(''), 2700);
          }}
        />
      )}

      {printData && <PrintableInvoice invoice={printData} />}
    </div>
  );
}

function PaymentModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const remaining = Number(invoice.total) - Number(invoice.paid);
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER'>('CASH');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    try {
      await api('/payments', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: invoice.id, amount: Number(amount), method, notes }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'تعذر تسجيل الدفعة');
    }
  }

  return (
    <Modal title="تسجيل سداد وتحصيل دفعة" subtitle={`${invoice.invoiceNo} — المتبقي: ${remaining.toLocaleString('ar-EG')} ج.م`} onClose={onClose}>
      <div className="form-grid">
        <label>المبلغ المدفوع (ج.م) *
          <input type="number" min="0.01" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>

        <label>وسيلة الدفع *
          <select value={method} onChange={(e) => setMethod(e.target.value as any)}>
            <option value="CASH">نقدي (CASH)</option>
            <option value="CARD">بطاقة ائتمان (CARD)</option>
            <option value="BANK_TRANSFER">تحويل بنكي / InstaPay</option>
          </select>
        </label>

        <label className="full-span">ملاحظات / مرجع الإيصال
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="رقم الإيصال النقدي..." />
        </label>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="modal-actions">
        <button className="button primary" onClick={() => void submit()} disabled={!amount || Number(amount) <= 0}>تأكيد التحصيل السريع</button>
        <button className="button secondary" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}

function InvoiceModal({ owners, pets, products, onClose, onSaved }: { owners: Owner[]; pets: Pet[]; products: Product[]; onClose: () => void; onSaved: () => void }) {
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');
  const [petId, setPetId] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ description: 'كشف طبـي بيطري عام', quantity: 1, unitPrice: 200 }]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const ownerPets = pets.filter((p) => p.ownerId === ownerId);

  useEffect(() => {
    setPetId(ownerPets[0]?.id ?? '');
  }, [ownerId]);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  function selectProduct(index: number, productId: string) {
    const prd = products.find((p) => p.id === productId);
    if (prd) {
      updateItem(index, { productId, description: prd.name, unitPrice: Number(prd.sellPrice) });
    } else {
      updateItem(index, { productId: undefined });
    }
  }

  async function submit() {
    setSaving(true);
    try {
      await api('/invoices', {
        method: 'POST',
        body: JSON.stringify({ ownerId, petId: petId || undefined, subtotal, discount, tax, items }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'تعذر إصدار الفاتورة');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="إصدار فاتورة عيادة جديدة" subtitle="خصم المنتجات تلقائياً وحساب الإجمالي" onClose={onClose}>
      <div className="invoice-form">
        <div className="form-grid compact">
          <label>المالك / العميل *
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {owners.map((client) => (
                <option key={client.id} value={client.id}>{client.fullName} — {client.phone}</option>
              ))}
            </select>
          </label>
          <label>الحيوان الأليف المرتبط
            <select value={petId} onChange={(e) => setPetId(e.target.value)}>
              <option value="">(بدون تحديد حيوان)</option>
              {ownerPets.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.species === 'CAT' ? 'قطة' : 'كلب'})</option>
              ))}
            </select>
          </label>
        </div>

        <div className="invoice-items">
          <header>
            <h4>بنود الفاتورة ({items.length})</h4>
            <button onClick={() => setItems((current) => [...current, { description: '', quantity: 1, unitPrice: 0 }])}>
              <Plus size={15} /> إضافة بند جديد
            </button>
          </header>
          {items.map((item, index) => (
            <div className="invoice-item-row" key={index}>
              <select value={item.productId || ''} onChange={(e) => selectProduct(index, e.target.value)}>
                <option value="">خدمة / بيان يدوي</option>
                {products.map((p) => (
                  <option value={p.id} key={p.id}>{p.name} ({p.stockQty} {p.unit})</option>
                ))}
              </select>
              <input value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} placeholder="وصف الخدمة أو المنتج..." />
              <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} />
              <input type="number" min="0" value={item.unitPrice} onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })} />
              <strong>{(item.quantity * item.unitPrice).toLocaleString('ar-EG')} ج.م</strong>
              <button className="icon-button danger" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, i) => i !== index))}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <div className="invoice-calculation">
          <div className="payment-fields">
            <label>خصم (ج.م)
              <input type="number" min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </label>
            <label>ضريبة (ج.م)
              <input type="number" min="0" value={tax} onChange={(e) => setTax(Number(e.target.value))} />
            </label>
          </div>
          <div className="invoice-totals">
            <span>المجموع: <b>{subtotal.toLocaleString('ar-EG')} ج.م</b></span>
            <span>الخصم: <b>- {discount.toLocaleString('ar-EG')} ج.م</b></span>
            <strong>إجمالي الفاتورة الصافي: <b>{(subtotal - discount + tax).toLocaleString('ar-EG')} ج.م</b></strong>
          </div>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="modal-actions">
        <button className="button primary" onClick={() => void submit()} disabled={saving || !ownerId || items.some((i) => !i.description)}>
          {saving ? 'جارٍ إصدار الفاتورة...' : 'إصدار الفاتورة'}
        </button>
        <button className="button secondary" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}

function PrintableInvoice({ invoice }: { invoice: Invoice }) {
  return (
    <section className="print-invoice" style={{ display: 'block' }}>
      <header>
        <div>
          <h1>عيادة أليف البيطرية (قطط وكلاب)</h1>
          <p>إيصال وفاتورة رسمية</p>
        </div>
        <ReceiptText size={36} />
      </header>

      <div className="print-meta">
        <span><b>رقم الفاتورة:</b> {invoice.invoiceNo}</span>
        <span><b>التاريخ:</b> {new Date(invoice.createdAt!).toLocaleDateString('ar-EG')}</span>
        <span><b>العميل:</b> {invoice.owner?.fullName}</span>
        <span><b>الهاتف:</b> {invoice.owner?.phone}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>البيان والخدمة</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item) => (
            <tr key={item.id}>
              <td>{item.description}</td>
              <td>{item.quantity}</td>
              <td>{Number(item.unitPrice).toLocaleString('ar-EG')}</td>
              <td>{Number(item.total).toLocaleString('ar-EG')} ج.م</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="print-total">
        <span>الإجمالي: {Number(invoice.subtotal).toLocaleString('ar-EG')} ج.م</span>
        <span>الخصم: {Number(invoice.discount).toLocaleString('ar-EG')} ج.م</span>
        <strong>الصافي: {Number(invoice.total).toLocaleString('ar-EG')} ج.م</strong>
        <span>المدفوع: {Number(invoice.paid).toLocaleString('ar-EG')} ج.م</span>
      </div>

      <footer>عيادة أليف البيطرية • شكرًا لثقتكم 🐾</footer>
    </section>
  );
}
