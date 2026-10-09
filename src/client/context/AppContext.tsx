import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Product, CartItem, Order, ToastMessage, ViewType } from '../types';

interface AppContextType {
  token: string | null;
  user: User | null;
  cartId: string;
  cart: CartItem[];
  orders: Order[];
  currentView: ViewType;
  toasts: ToastMessage[];
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setCurrentView: (view: ViewType) => void;
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string | number, quantity: number) => void;
  removeFromCart: (productId: string | number) => void;
  clearCart: () => void;
  addOrder: (txnId?: string) => Order;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', code?: string) => void;
  removeToast: (id: string) => void;
  cartCount: number;
  cartSubtotal: number;
  cartVat: number;
  cartTotal: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [user, setUserState] = useState<User | null>(() => {
    const saved = localStorage.getItem('authUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [cartId] = useState<string>('CRT-89241');
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('shoppingCart');
    return saved ? JSON.parse(saved) : [];
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('orderHistory');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'ORD-2025-8834',
        date: '2026-10-09',
        itemsCount: 3,
        total: 12500,
        status: 'ชำระเงินสำเร็จ',
        badgeClass: 'bg-success/10 text-success border-success/30',
        txnId: 'TXN-88392014-X9'
      },
      {
        id: 'ORD-2025-8720',
        date: '2026-09-28',
        itemsCount: 1,
        total: 4500,
        status: 'จัดส่งแล้ว',
        badgeClass: 'bg-info/10 text-info border-info/30',
        txnId: 'TXN-77123910-Y2'
      }
    ];
  });

  const [currentView, setCurrentViewState] = useState<ViewType>(() => (token ? 'products' : 'login'));
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('orderHistory', JSON.stringify(orders));
  }, [orders]);

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

  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => String(item.id) === String(product.id));
      if (existing) {
        return prev.map(item =>
          String(item.id) === String(product.id)
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name || product.title || `สินค้า #${product.id}`,
          price: Number(product.price) || 0,
          image_url: product.image_url || product.image || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=400&q=80',
          category: product.category || 'ทั่วไป',
          quantity: quantity
        }
      ];
    });
  };

  const updateCartQuantity = (productId: string | number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item => (String(item.id) === String(productId) ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (productId: string | number) => {
    setCart(prev => prev.filter(item => String(item.id) !== String(productId)));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartVat = Math.round(cartSubtotal * 0.07);
  const cartTotal = cartSubtotal === 0 ? 0 : cartSubtotal + cartVat;

  const addOrder = (txnId?: string): Order => {
    const newOrder: Order = {
      id: `ORD-2025-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0] || '',
      itemsCount: cartCount,
      total: cartTotal,
      status: 'ชำระเงินสำเร็จ',
      badgeClass: 'bg-success/10 text-success border-success/30',
      items: [...cart],
      txnId: txnId || `TXN-${Date.now()}`
    };

    setOrders(prev => [newOrder, ...prev]);
    return newOrder;
  };

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

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        token,
        user,
        cartId,
        cart,
        orders,
        currentView,
        toasts,
        setAuth,
        clearAuth,
        setCurrentView,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        addOrder,
        addToast,
        removeToast,
        cartCount,
        cartSubtotal,
        cartVat,
        cartTotal
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
