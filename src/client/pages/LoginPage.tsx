import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { loginApi } from '../services/api';

export const LoginPage: React.FC = () => {
  const { setAuth, addToast } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorState(null);

    if (!username || !password) return;

    setLoading(true);

    try {
      const data = await loginApi(username, password);
      addToast(`ยินดีต้อนรับคุณ ${data.user.username}!`, 'success');
      setAuth(data.accessToken, data.user);
    } catch (err: any) {
      console.error('Login error:', err);
      const code = err.code || `HTTP_${err.status || 401}`;
      const message = err.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
      setErrorState({ code, message });
      addToast(message, 'error', code);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center p-margin bg-background">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-lg shadow-sm p-8 flex flex-col gap-6 border border-surface-variant">
        
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-3xl">storefront</span>
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold">เข้าสู่ระบบ EatSomeWhere</h1>
            <p className="font-body-sm text-body-sm text-secondary">เข้าถึงพอร์ทัลลูกค้าและการจัดการคำสั่งซื้อ</p>
          </div>
        </div>

        {/* Error / Status Banner */}
        {errorState && (
          <div className="rounded-lg p-3 text-body-sm font-body-sm flex items-start gap-2.5 bg-error-container text-on-error-container border border-error/20">
            <span className="material-symbols-outlined text-lg leading-none mt-0.5 text-error">error</span>
            <div className="flex flex-col flex-1">
              <span className="font-code-sm text-code-sm font-bold tracking-tight">{errorState.code}</span>
              <span className="text-body-sm mt-0.5">{errorState.message}</span>
            </div>
            <button
              className="text-secondary hover:text-on-surface p-0.5"
              onClick={() => setErrorState(null)}
              type="button"
            >
              <span className="material-symbols-outlined text-sm leading-none">close</span>
            </button>
          </div>
        )}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface flex items-center justify-between" htmlFor="username-input">
              <span>ชื่อผู้ใช้ (Username / Email)</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="ป้อนชื่อผู้ใช้..."
                required
                className="w-full bg-surface-container-low text-on-surface placeholder-secondary px-3.5 py-2.5 rounded-lg text-body-md font-body-md focus:bg-surface-container-lowest outline-none transition-colors border border-outline-variant/40 focus:border-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="font-label-md text-label-md text-on-surface" htmlFor="password-input">
                รหัสผ่าน (Password)
              </label>
            </div>
            <div className="relative flex items-center">
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-surface-container-low text-on-surface placeholder-secondary px-3.5 py-2.5 pr-10 rounded-lg text-body-md font-body-md focus:bg-surface-container-lowest outline-none transition-colors border border-outline-variant/40 focus:border-primary"
              />
              <button
                type="button"
                className="absolute right-2.5 p-1 text-secondary hover:text-on-surface flex items-center justify-center focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                defaultChecked
                type="checkbox"
                className="w-4 h-4 rounded text-primary accent-primary bg-surface-container cursor-pointer"
              />
              <span className="font-body-sm text-body-sm text-on-surface">จดจำการเข้าสู่ระบบ (30 วัน)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3 rounded-lg transition-colors font-semibold shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <span>{loading ? 'กำลังตรวจสอบข้อมูล...' : 'เข้าสู่ระบบ'}</span>
            {loading && <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-surface-variant text-body-sm text-on-surface-variant">
          <span>สำหรับทดสอบ API กรุณากรอกบัญชีผู้ใช้และรหัสผ่านจากระบบ</span>
        </div>

      </div>
    </main>
  );
};
