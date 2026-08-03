import { useState } from 'react';
import { api, setSession } from '../api';
import type { User } from '../types';
import { PawPrint, Lock, User as UserIcon } from 'lucide-react';

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('dr_ahmed');
  const [password, setPassword] = useState('vet123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ accessToken: string; refreshToken?: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setSession(res.accessToken, res.refreshToken, res.user);
      onLogin(res.user);
    } catch (err: any) {
      setError(err.message || 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page" dir="rtl">
      <div className="login-visual">
        <div className="visual-overlay">
          <div className="brand">
            <div className="brand-mark">
              <PawPrint size={24} />
            </div>
            <span>
              <strong>أليف 🐾</strong>
              <small>نظام العيادة البيطرية المتقدم (قطط وكلاب)</small>
            </span>
          </div>
          <div className="visual-copy">
            <span className="eyebrow">إدارة بيطرية متخصصة ومحترفة</span>
            <h1>الرعاية المتكاملة <em>للقطط والكلاب</em></h1>
            <p>سجل طبي شامل (SOAP)، إدارة تطعيمات حصرية حسب النوع، فواتير ومخزون دقيق مع تتبع كافة المعاملات المالية الحساسة.</p>
          </div>
          <div className="visual-stats">
            <span>
              <strong>CAT & DOG Only</strong>
              <small>تقييد صارم 100%</small>
            </span>
            <span>
              <strong>SOAP Visits</strong>
              <small>روشتات وجرعات دقيقة</small>
            </span>
            <span>
              <strong>Audit Logging</strong>
              <small>أمان وسجلات شمولية</small>
            </span>
          </div>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <h2>تسجيل الدخول للنظام 🔐</h2>
          <p>أدخل اسم المستخدم وكلمة المرور لمتابعة العمل</p>

          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <label>
              <span>اسم المستخدم</span>
              <div className="input-with-icon">
                <UserIcon size={16} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="مثال: dr_ahmed"
                />
              </div>
            </label>

            <label>
              <span>كلمة المرور</span>
              <div className="input-with-icon">
                <Lock size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
            </label>

            <button type="submit" className="button primary login-button" disabled={loading}>
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>

          <div className="demo-hint">
            <div>
              <strong>طبيب:</strong> <span>dr_ahmed / vet123</span>
            </div>
            <div>
              <strong>مدير:</strong> <span>admin / admin123</span>
            </div>
          </div>
        </div>
        <footer>© 2026 عيادة أليف البيطرية — جميع الحقوق محفوظة</footer>
      </div>
    </div>
  );
}
