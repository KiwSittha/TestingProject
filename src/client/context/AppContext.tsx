import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchCartApi, fetchSessionApi, setAuthRequiredHandler } from '../services/api';
import type { User, Cart, AppMessage, MessageKind, MessageTone, Stage } from '../types';

interface AppContextType {
  token: string | null;
  user: User | null;
  cart: Cart | null;
  // stage ของ Customer จาก GET /me (null = ยังไม่โหลด หรือเป็น Admin)
  stage: Stage | null;
  stageOrderId: string | null;
  sessionLoaded: boolean;
  path: string;
  messages: AppMessage[];
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  setStage: (stage: Stage, orderId: string | null) => void;
  refreshSession: () => Promise<void>;
  applyCart: (cart: Cart) => void;
  refreshCart: () => Promise<void>;
  clearCart: () => void;
  addToast: (message: string, tone?: MessageTone, code?: string) => void;
  addNotice: (code: string, message: string) => void;
  showApiError: (err: any, fallback: string) => void;
  removeMessage: (id: string) => void;
  cartCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ข้อความหายเองหลังเวลานี้ (ผู้ใช้กดปิดเองได้)
const MESSAGE_TIMEOUT_MS = 6000;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [user, setUserState] = useState<User | null>(() => {
    const saved = localStorage.getItem('authUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [cart, setCart] = useState<Cart | null>(null);
  const [stage, setStageState] = useState<Stage | null>(null);
  const [stageOrderId, setStageOrderId] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [path, setPath] = useState<string>(() => window.location.pathname);
  const [messages, setMessages] = useState<AppMessage[]>([]);

  // ---------- URL (DC-2.12) ----------

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string, options: { replace?: boolean } = {}) => {
    if (to !== window.location.pathname) {
      if (options.replace) window.history.replaceState(null, '', to);
      else window.history.pushState(null, '', to);
    }
    setPath(to);
  }, []);

  // ---------- ข้อความ (DC-2.8) ----------

  const removeMessage = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const pushMessage = (kind: MessageKind, tone: MessageTone, text: string, code = '') => {
    const message: AppMessage = {
      id: Math.random().toString(36).substring(2, 9),
      kind,
      tone,
      text,
      code
    };
    setMessages(prev => [...prev, message]);
    setTimeout(() => removeMessage(message.id), MESSAGE_TIMEOUT_MS);
  };

  // ข้อความทั่วไป: tone "error" ที่มี code เป็นการปฏิเสธ (error) ที่เหลือเป็น info
  const addToast = (message: string, tone: MessageTone = 'success', code?: string) => {
    if (tone === 'error' && code) pushMessage('error', 'error', message, code);
    else pushMessage('info', tone, message);
  };

  const addNotice = (code: string, message: string) => {
    pushMessage('notice', 'warning', message, code);
  };

  const showApiError = (err: any, fallback: string) => {
    console.error(fallback, err);
    // AUTH_REQUIRED พาไปหน้า login พร้อมข้อความของมันเองแล้ว
    if (err.code !== 'AUTH_REQUIRED') {
      pushMessage('error', 'error', err.message || fallback, err.code || 'UNKNOWN_ERROR');
    }
  };

  // ---------- session และ stage (FR-1.2) ----------

  const refreshSession = async () => {
    if (!token) return;
    try {
      const data = await fetchSessionApi(token);
      setUserState(data.user);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      setStageState(data.stage);
      setStageOrderId(data.orderId);
      setSessionLoaded(true);
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
    }
  };

  const setStage = (newStage: Stage, orderId: string | null) => {
    setStageState(newStage);
    setStageOrderId(orderId);
    setSessionLoaded(true);
  };

  const refreshCart = async () => {
    // GET /cart เป็นของ Customer เท่านั้น
    if (!token || user?.role !== 'Customer') return;

    try {
      const data = await fetchCartApi(token);
      applyCart(data.cart);
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถโหลดตะกร้าสินค้าได้');
    }
  };

  useEffect(() => {
    setSessionLoaded(false);
    setStageState(null);
    setStageOrderId(null);
    if (token) {
      refreshSession();
      refreshCart();
    }
  }, [token]);

  useEffect(() => {
    setAuthRequiredHandler(() => {
      // request ที่ยิงพร้อมกันอาจได้ 401 หลายตัว ให้ทำงานแค่ครั้งแรก
      if (!localStorage.getItem('accessToken')) return;
      clearAuth();
      addToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง', 'warning');
    });
    return () => setAuthRequiredHandler(null);
  }, []);

  // ---------- auth ----------

  const setAuth = (newToken: string, newUser: User) => {
    localStorage.setItem('accessToken', newToken);
    localStorage.setItem('authUser', JSON.stringify(newUser));
    setUserState(newUser);
    setTokenState(newToken);
    navigate(newUser.role === 'Admin' ? '/admin/products' : '/products', { replace: true });
  };

  const clearAuth = () => {
    setTokenState(null);
    setUserState(null);
    setCart(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('authUser');
    navigate('/login', { replace: true });
  };

  // ---------- cart ----------

  const applyCart = (newCart: Cart) => {
    setCart(newCart);
  };

  const clearCart = () => {
    setCart(null);
  };

  const cartCount = cart?.totalQuantity ?? 0;

  return (
    <AppContext.Provider
      value={{
        token,
        user,
        cart,
        stage,
        stageOrderId,
        sessionLoaded,
        path,
        messages,
        setAuth,
        clearAuth,
        navigate,
        setStage,
        refreshSession,
        applyCart,
        refreshCart,
        clearCart,
        addToast,
        addNotice,
        showApiError,
        removeMessage,
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
