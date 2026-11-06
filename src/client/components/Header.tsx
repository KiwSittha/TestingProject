import React from 'react';
import { useApp } from '../context/AppContext';
import type { PageKey } from '../types';

const PAGE_LABELS: Record<PageKey, string> = {
  login: 'เข้าสู่ระบบ',
  loading: 'กำลังโหลด',
  products: 'รายการสินค้า (Products Catalog)',
  cart: 'ตะกร้าสินค้า (Cart)',
  checkout: 'ชำระเงิน (Checkout)',
  success: 'ชำระเงินสำเร็จ (Order Success)',
  orders: 'ประวัติคำสั่งซื้อ (Orders Ledger)',
  'order-detail': 'รายละเอียดคำสั่งซื้อ (Order Detail)',
  'admin-products': 'จัดการสินค้า (Admin)',
  'admin-coupons': 'จัดการคูปอง (Admin)'
};

interface NavItem {
  testId: string;
  label: string;
  to: string;
  active: boolean;
  badge?: number;
}

export const Header: React.FC<{ page: PageKey }> = ({ page }) => {
  const { token, user, navigate, clearAuth, cartCount } = useApp();

  if (!token || !user || page === 'login') return null;

  const isAdmin = user.role === 'Admin';
  const home = isAdmin ? '/admin/products' : '/products';

  // เมนูตามบทบาท (ตาราง 6.2.1 แถว "ทุกหน้าหลัง login")
  const navItems: NavItem[] = isAdmin
    ? [
        { testId: 'nav-admin-products', label: 'จัดการสินค้า', to: '/admin/products', active: page === 'admin-products' },
        { testId: 'nav-admin-coupons', label: 'จัดการคูปอง', to: '/admin/coupons', active: page === 'admin-coupons' }
      ]
    : [
        { testId: 'nav-products', label: 'สินค้า', to: '/products', active: page === 'products' },
        { testId: 'nav-cart', label: 'ตะกร้าสินค้า', to: '/cart', active: page === 'cart' || page === 'checkout' || page === 'success', badge: cartCount },
        { testId: 'nav-orders', label: 'คำสั่งซื้อ', to: '/orders', active: page === 'orders' || page === 'order-detail' }
      ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest border-b border-surface-variant shadow-sm">
        <div className="h-16 max-w-[1280px] mx-auto px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-lg">
            <div
              className="flex items-center gap-space-sm cursor-pointer"
              onClick={() => navigate(home)}
            >
              <span className="material-symbols-outlined text-primary text-2xl">storefront</span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">EatSomeWhere</span>
            </div>

            <nav className="flex items-center gap-space-lg h-16">
              {navItems.map(item => (
                <button
                  key={item.testId}
                  type="button"
                  data-testid={item.testId}
                  onClick={() => navigate(item.to)}
                  className={`h-full flex items-center gap-space-xs transition-colors font-label-md text-label-md ${
                    item.active
                      ? 'text-primary font-semibold border-b-2 border-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {item.label}
                  {item.badge !== undefined && (
                    <span className="inline-flex items-center justify-center px-space-xs py-0.5 rounded-lg bg-secondary-container font-code-sm text-code-sm text-on-secondary-fixed">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-space-md">
            <div className="hidden sm:flex flex-col text-right">
              <span className="font-label-md text-label-md text-on-surface leading-tight font-bold">{user.username}</span>
              <span className="font-code-sm text-code-sm text-on-surface-variant">{user.role}</span>
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
            <span className="hover:text-on-surface cursor-pointer" onClick={() => navigate(home)}>หน้าแรก</span>
            <span>/</span>
            <span className="text-on-surface font-medium capitalize">{PAGE_LABELS[page]}</span>
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
