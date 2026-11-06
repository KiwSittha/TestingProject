import React, { useEffect } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { ToastContainer } from './components/ToastContainer';
import { LoginPage } from './pages/LoginPage';
import { ProductsPage } from './pages/ProductsPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminCouponsPage } from './pages/AdminCouponsPage';
import type { PageKey, Stage, User } from './types';

// URL ของแต่ละหน้า (ตาราง 6.2.2)
const STAGE_PATHS = ['/cart', '/checkout', '/success'];

// หน้าที่ตรงกับ stage (ส่วนที่ 2): เปิด URL ของหน้าที่ไม่ตรงกับ stage ให้แสดงหน้าของ stage ปัจจุบัน (DC-2.13)
const STAGE_PAGE: Record<Stage, PageKey> = {
  'ตะกร้า': 'cart',
  'ชำระเงิน': 'checkout',
  'สำเร็จ': 'success'
};

// เลือกหน้าจาก URL บทบาท และ stage
function resolvePage(path: string, user: User | null, token: string | null, stage: Stage | null, sessionLoaded: boolean): PageKey {
  if (!token || !user) return 'login';

  if (user.role === 'Admin') {
    return path === '/admin/coupons' ? 'admin-coupons' : 'admin-products';
  }

  if (STAGE_PATHS.includes(path)) {
    if (!sessionLoaded || !stage) return 'loading';
    return STAGE_PAGE[stage];
  }
  if (path === '/orders') return 'orders';
  if (path.startsWith('/orders/')) return 'order-detail';
  return 'products';
}

// URL ที่ควรแสดงในแถบที่อยู่เมื่อเปิด path ที่ไม่มีหน้า (เช่น / หรือ /login หลัง login แล้ว)
function canonicalPath(page: PageKey, path: string): string | null {
  if (page === 'products' && path !== '/products') return '/products';
  if (page === 'admin-products' && path !== '/admin/products') return '/admin/products';
  return null;
}

export const App: React.FC = () => {
  const { token, user, stage, sessionLoaded, path, navigate } = useApp();
  const page = resolvePage(path, user, token, stage, sessionLoaded);

  useEffect(() => {
    const target = canonicalPath(page, path);
    if (target) navigate(target, { replace: true });
  }, [page, path]);

  const renderPage = () => {
    switch (page) {
      case 'login':
        return <LoginPage />;
      case 'loading':
        return (
          <main className="w-full min-h-[calc(100vh-8rem)] flex items-center justify-center bg-background">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
          </main>
        );
      case 'products':
        return <ProductsPage />;
      case 'cart':
        return <CartPage />;
      case 'checkout':
        return <CheckoutPage />;
      case 'success':
        return <OrderConfirmationPage />;
      case 'orders':
        return <OrderHistoryPage />;
      case 'order-detail':
        return <OrderDetailPage orderId={decodeURIComponent(path.slice('/orders/'.length))} />;
      case 'admin-products':
        return <AdminProductsPage />;
      case 'admin-coupons':
        return <AdminCouponsPage />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer />
      <Header page={page} />
      {renderPage()}
    </div>
  );
};
