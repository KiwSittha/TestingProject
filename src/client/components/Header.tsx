import React from 'react';
import { useApp } from '../context/AppContext';

export const Header: React.FC = () => {
  const { token, user, currentView, setCurrentView, clearAuth, cartCount } = useApp();

  if (!token || currentView === 'login') return null;

  const username = user?.username || 'Sarah Jenkins';
  const role = user?.role || 'บัญชีองค์กร';

  const viewLabels: Record<string, string> = {
    products: 'รายการสินค้า (Products Catalog)',
    cart: 'ตะกร้าสินค้า (Cart)',
    checkout: 'ตรวจสอบคำสั่งซื้อ (Checkout)',
    'order-confirmation': 'ยืนยันคำสั่งซื้อ (Order Success)',
    'order-history': 'ประวัติคำสั่งซื้อ (Orders Ledger)'
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest border-b border-surface-variant shadow-sm">
        <div className="h-16 max-w-[1280px] mx-auto px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-lg">
            <div 
              className="flex items-center gap-space-sm cursor-pointer" 
              onClick={() => setCurrentView('products')}
            >
              <span className="material-symbols-outlined text-primary text-2xl">storefront</span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">EatSomeWhere</span>
            </div>

            <nav className="hidden md:flex items-center gap-space-lg h-16">
              <button
                type="button"
                onClick={() => setCurrentView('products')}
                className={`h-full flex items-center transition-colors font-label-md text-label-md ${
                  currentView === 'products'
                    ? 'text-primary font-semibold border-b-2 border-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                สินค้า
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('cart')}
                className={`h-full flex items-center gap-space-xs transition-colors font-label-md text-label-md ${
                  currentView === 'cart' || currentView === 'checkout'
                    ? 'text-primary font-semibold border-b-2 border-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                ตะกร้าสินค้า
                <span className="inline-flex items-center justify-center px-space-xs py-0.5 rounded-lg bg-secondary-container font-code-sm text-code-sm text-on-secondary-fixed">
                  {cartCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('order-history')}
                className={`h-full flex items-center transition-colors font-label-md text-label-md ${
                  currentView === 'order-history' || currentView === 'order-confirmation'
                    ? 'text-primary font-semibold border-b-2 border-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                คำสั่งซื้อ
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-space-md">
            <div className="hidden sm:flex flex-col text-right">
              <span className="font-label-md text-label-md text-on-surface leading-tight font-bold">{username}</span>
              <span className="font-code-sm text-code-sm text-on-surface-variant">{role}</span>
            </div>
            <img
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover border border-outline-variant/40"
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
            />
            <button
              type="button"
              title="ออกจากระบบ"
              onClick={clearAuth}
              className="flex items-center justify-center p-2 rounded-lg text-secondary hover:text-error hover:bg-error-container/20 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="w-full pt-16 bg-surface-container-lowest border-b border-surface-variant">
        <div className="max-w-[1280px] mx-auto px-margin py-space-sm flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
          <div className="flex items-center gap-space-xs">
            <span className="hover:text-on-surface cursor-pointer" onClick={() => setCurrentView('products')}>หน้าแรก</span>
            <span>/</span>
            <span className="text-on-surface font-medium capitalize">{viewLabels[currentView] || 'พอร์ทัล'}</span>
          </div>
          <div className="flex items-center gap-space-sm font-code-sm text-code-sm text-on-surface-variant">
            <span className="inline-block w-2 h-2 rounded-full bg-success"></span>
            <span>API Connected (Express backend)</span>
          </div>
        </div>
      </div>
    </>
  );
};
