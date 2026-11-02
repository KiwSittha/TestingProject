import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchCartApi, setAuthRequiredHandler } from '../services/api';
import type { User, Cart, Order, ToastMessage, ViewType } from '../types';

interface AppContextType {
  token: string | null;
  user: User | null;
  cart: Cart | null;
  currentOrder: Order | null;
  currentView: ViewType;
  toasts: ToastMessage[];
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setCurrentView: (view: ViewType) => void;
  setCurrentOrder: (order: Order | null) => void;
  applyCart: (cart: Cart) => void;
  refreshCart: () => Promise<void>;
  clearCart: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', code?: string) => void;
  showApiError: (err: any, fallback: string) => void;
  removeToast: (id: string) => void;
  cartCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [user, setUserState] = useState<User | null>(() => {
    const saved = localStorage.getItem('authUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [cart, setCart] = useState<Cart | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  const [currentView, setCurrentViewState] = useState<ViewType>(() => (token ? 'products' : 'login'));
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    refreshCart();
  }, [token]);

  useEffect(() => {
    setAuthRequiredHandler(() => {
      // Requests running in parallel can all fail with 401, only react to the first one
      if (!localStorage.getItem('accessToken')) return;
      clearAuth();
      addToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง', 'warning');
    });
    return () => setAuthRequiredHandler(null);
  }, []);

  const setAuth = (newToken: string, newUser: User) => {
    setTokenState(newToken);
    setUserState(newUser);
    localStorage.setItem('accessToken', newToken);
    localStorage.setItem('authUser', JSON.stringify(newUser));
    setCurrentViewState('products');
  };

  const clearAuth = () => {
    setTokenState(null);
    setUserState(null);
    setCart(null);
    setCurrentOrder(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('authUser');
    setCurrentViewState('login');
  };

  const setCurrentView = (view: ViewType) => {
    if (!token && view !== 'login') {
      setCurrentViewState('login');
    } else {
      setCurrentViewState(view);
    }
  };

  const applyCart = (newCart: Cart) => {
    setCart(newCart);
    if (newCart.notice) {
      addToast(newCart.notice, 'warning');
    }
  };

  const refreshCart = async () => {
    // GET /cart is Customer only
    if (!token || user?.role !== 'Customer') return;

    try {
      const data = await fetchCartApi(token);
      applyCart(data.cart);
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถโหลดตะกร้าสินค้าได้');
    }
  };

  const clearCart = () => {
    setCart(null);
  };

  const cartCount = cart?.totalQuantity ?? 0;

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success', code?: string) => {
    const newToast: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
      code
    };
    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      removeToast(newToast.id);
    }, 4000);
  };

  const showApiError = (err: any, fallback: string) => {
    console.error(fallback, err);
    // AUTH_REQUIRED already sent the user back to login with its own message
    if (err.code !== 'AUTH_REQUIRED') {
      addToast(err.message || fallback, 'error', err.code);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        token,
        user,
        cart,
        currentOrder,
        currentView,
        toasts,
        setAuth,
        clearAuth,
        setCurrentView,
        setCurrentOrder,
        applyCart,
        refreshCart,
        clearCart,
        addToast,
        showApiError,
        removeToast,
        cartCount
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
