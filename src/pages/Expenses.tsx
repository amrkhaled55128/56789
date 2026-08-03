import { useEffect, useState } from 'react';
import { CreditCard, Plus, ReceiptText, TrendingDown } from 'lucide-react';
import { api } from '../api';

export function Expenses() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  async function load() {
    try {
      const [inv, pay] = await Promise.all([
        api<any[]>('/invoices'),
        api<any[]>('/payments'),
      ]);
      setInvoices(inv);
      setPayments(pay);
    } catch (e) {}
  }

  useEffect(() => {
    load();
  }, []);

  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">الخزينة والمقبوضات</span>
          <h2>حركة الخزينة والمدفوعات 💵</h2>
          <p>سجل كافة المتحصلات والدفعات الواردة بالعيادة.</p>
        </div>
      </div>

      <section className="inventory-metrics">
        <div>
          <span className="inventory-icon teal"><CreditCard /></span>
          <span><small>إجمالي المقبوضات المحصلة</small><strong>{totalCollected.toLocaleString('ar-EG')} ج.م</strong></span>
        </div>
        <div>
          <span className="inventory-icon purple"><ReceiptText /></span>
          <span><small>عدد عمليات الدفع</small><strong>{payments.length}</strong></span>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h3>سجل المدفوعات الواردة</h3>
            <p>جميع المقبوضات المسجلة</p>
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>التاريخ والوقت</th>
                <th>اسم العميل / المالك</th>
                <th>المبلغ المدفوع</th>
                <th>طريقة الدفع</th>
                <th>المحصل بواسطة</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={6} className="table-message">لا توجد دفعات محصلة حتى الآن</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{new Date(p.createdAt).toLocaleString('ar-EG')}</td>
                    <td><strong>{p.owner?.fullName || 'غير مدون'}</strong></td>
                    <td><strong style={{ color: '#28a177' }}>+{Number(p.amount).toLocaleString('ar-EG')} ج.م</strong></td>
                    <td><span className="tag teal">{p.method}</span></td>
                    <td>{p.createdBy?.fullName || 'الاستقبال'}</td>
                    <td>{p.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
