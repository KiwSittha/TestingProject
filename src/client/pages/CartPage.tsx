import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { applyCouponApi, checkoutApi, removeCartItemApi, updateCartItemApi } from '../services/api';
import { PRODUCT_STATUS, SHIPPING_SPEEDS, SHIPPING_ZONES } from '../../config/business';
import { DEFAULT_PRODUCT_IMAGE, SPEED_LABELS, ZONE_LABELS } from '../constants';
import type { Cart, CartItem } from '../types';

const money = (value: number) => value.toLocaleString('th-TH', { minimumFractionDigits: 2 });

// FR-2.9: สินค้าพร้อมขาย = สถานะเปิดขาย และสต็อกพร้อมขายอย่างน้อย 1
const isAvailable = (item: CartItem) => item.status === PRODUCT_STATUS.ON_SALE && item.availableStock >= 1;

// หน้าของ stage `ตะกร้า` (page-cart)
export const CartPage: React.FC = () => {
  const {
    token,
    cart,
    cartCount,
    applyCart,
    refreshCart,
    showApiError,
    addToast,
    addNotice,
    navigate,
    setStage
  } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [zone, setZone] = useState<string>('inCity');
  const [speed, setSpeed] = useState<string>('standard');

  const items = cart?.items ?? [];

  useEffect(() => {
    refreshCart().finally(() => setLoading(false));
  }, []);

  const runCartAction = async (action: (token: string) => Promise<{ message?: string; cart: Cart }>, fallback: string) => {
    if (!token) return null;
    setSaving(true);

    try {
      const data = await action(token);
      applyCart(data.cart);
      setDraftQuantities({});
      return data;
    } catch (err: any) {
      showApiError(err, fallback);
      await refreshCart();
      return null;
    } finally {
      setSaving(false);
    }
  };

  // OP-4 updateQuantity
  const handleUpdateQuantity = (productId: string, quantity: number) => {
    runCartAction(t => updateCartItemApi(t, productId, quantity), 'ไม่สามารถแก้ไขจำนวนสินค้าได้');
  };

  // OP-5 removeItem: ลบรายการสุดท้ายแล้วแสดง "ตะกร้าว่าง" (FR-2.7.4)
  const handleRemove = async (productId: string) => {
    const data = await runCartAction(t => removeCartItemApi(t, productId), 'ไม่สามารถลบสินค้าออกจากตะกร้าได้');
    if (data && data.cart.items.length === 0) {
      addToast('ตะกร้าว่าง', 'info');
    }
  };

  // API ไม่มีคำสั่งล้างตะกร้า จึงลบทีละรายการ
  const handleClearCart = async () => {
    const data = await runCartAction(async t => {
      let latest = { cart: cart as Cart };
      for (const item of items) {
        latest = await removeCartItemApi(t, item.productId);
      }
      return latest;
    }, 'ไม่สามารถล้างตะกร้าสินค้าได้');
    if (data && data.cart.items.length === 0) {
      addToast('ตะกร้าว่าง', 'info');
    }
  };

  // OP-6 applyCoupon
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim();
    if (!code) return;

    const applied = await runCartAction(t => applyCouponApi(t, code), 'ไม่สามารถใช้คูปองได้');
    if (applied) {
      setCouponCode('');
      addToast(`ผูกคูปอง ${code} กับตะกร้าแล้ว`, 'success');
    }
  };

  // OP-8 pressCheckout: สร้างออเดอร์แล้วไปหน้าชำระเงิน
  const handleCheckout = async () => {
    if (!token) return;
    setSaving(true);

    try {
      const data = await checkoutApi(token, zone, speed);
      setStage('ชำระเงิน', data.order.id);
      navigate('/checkout');
      if (data.notice) {
        addNotice('COUPON_NOT_APPLICABLE', data.notice);
      }
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถสร้างคำสั่งซื้อได้');
      await refreshCart();
    } finally {
      setSaving(false);
    }
  };

  return (
    <main data-testid="page-cart" className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
      <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col gap-space-lg">

        {/* Header Metadata */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-sm pb-space-md border-b border-surface-variant">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs text-on-surface-variant font-code-sm text-code-sm tracking-wider uppercase">
              {cart && (
                <>
                  <span>รอบตะกร้าสินค้า #{cart.cartId}</span>
                  <span>•</span>
                </>
              )}
              <span>{cartCount} ชิ้น</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              ตะกร้าสินค้าสำหรับองค์กร
            </h1>
          </div>

          <button
            type="button"
            onClick={() => navigate('/products')}
            className="flex items-center gap-1 text-primary hover:text-on-primary-fixed-variant font-label-md font-semibold"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>เลือกซื้อสินค้าต่อ</span>
          </button>
        </div>

        {loading && !cart ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
            <p className="font-body-md text-on-surface-variant font-medium">กำลังโหลดตะกร้าสินค้า...</p>
          </div>
        ) : !cart ? null : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

            {/* Items List */}
            <div className="lg:col-span-8 flex flex-col gap-space-md">
              {items.length === 0 ? (
                <div className="w-full bg-surface-container-lowest rounded-lg p-16 border border-surface-variant text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-3xl">shopping_cart</span>
                  </div>
                  <h2 className="font-headline-md text-headline-md font-bold text-on-surface">ตะกร้าว่าง</h2>
                  <p className="font-body-md text-on-surface-variant max-w-md">
                    เลือกชมสินค้าและเพิ่มรายการลงในตะกร้าเพื่อดำเนินการจัดซื้อสำหรับองค์กร
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/products')}
                    className="mt-2 bg-primary hover:bg-primary-container text-on-primary font-label-md px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    เรียกดูแคตตาล็อกสินค้า
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-surface-container-lowest rounded-lg border border-surface-variant shadow-sm divide-y divide-surface-variant overflow-hidden">
                    {items.map(item => {
                      const available = isAvailable(item);
                      const draft = draftQuantities[item.productId] ?? String(item.quantity);

                      return (
                        <div
                          key={item.productId}
                          data-testid={`cart-line-${item.productId}`}
                          className="p-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md"
                        >
                          <div className="flex items-center gap-space-md flex-1">
                            <img
                              src={DEFAULT_PRODUCT_IMAGE}
                              alt={item.name}
                              className="w-16 h-16 rounded-lg object-cover bg-surface-container border border-surface-variant shrink-0"
                            />
                            <div className="flex flex-col gap-0.5">
                              <span className="font-code-sm text-code-sm text-on-surface-variant">{item.productId}</span>
                              <h4 data-testid="cart-line-name" className="font-headline-sm text-label-md text-on-surface font-semibold line-clamp-1">{item.name}</h4>
                              <span className="font-code-sm text-code-sm text-secondary">
                                ราคาต่อหน่วย: <span data-testid="cart-line-unit-price" data-value={item.price}>฿{money(item.price)}</span>
                              </span>
                              <span
                                data-testid="cart-line-availability"
                                data-available={String(available)}
                                className={`self-start mt-1 px-2 py-0.5 rounded font-code-sm text-code-sm font-semibold ${
                                  available ? 'bg-success/10 text-success' : 'bg-error-container text-on-error-container'
                                }`}
                              >
                                {available ? 'พร้อมขาย' : 'ไม่พร้อมขาย'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-space-md w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                            <div className="flex flex-col items-center">
                              <span className="font-code-sm text-code-sm text-on-surface-variant">จำนวน</span>
                              <span data-testid="cart-line-qty" data-value={item.quantity} className="font-code-md text-code-md font-bold text-on-surface">
                                {item.quantity}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <label className="sr-only" htmlFor={`cart-qty-${item.productId}`}>จำนวนใหม่ของ {item.name}</label>
                              <input
                                id={`cart-qty-${item.productId}`}
                                type="number"
                                inputMode="numeric"
                                data-testid="cart-line-qty-input"
                                value={draft}
                                onChange={e => setDraftQuantities(prev => ({ ...prev, [item.productId]: e.target.value }))}
                                className="w-16 px-2 py-2 bg-surface-container-low border border-outline-variant/40 rounded-lg text-body-sm text-center"
                              />
                              <button
                                type="button"
                                data-testid="cart-line-update"
                                disabled={saving}
                                onClick={() => handleUpdateQuantity(item.productId, Number(draft))}
                                className="px-3 py-2 bg-surface-container hover:bg-surface-variant text-on-surface font-label-md font-semibold rounded-lg transition-colors disabled:opacity-60"
                              >
                                แก้จำนวน
                              </button>
                            </div>

                            <div className="text-right min-w-[100px]">
                              <span className="font-code-md text-body-lg text-primary font-bold">฿{money(item.lineTotal)}</span>
                            </div>

                            <button
                              type="button"
                              title="ลบรายการ"
                              data-testid="cart-line-remove"
                              disabled={saving}
                              onClick={() => handleRemove(item.productId)}
                              className="p-2 text-secondary hover:text-error hover:bg-error-container/20 rounded-lg transition-colors disabled:opacity-60"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center px-1">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleClearCart}
                      className="text-error hover:underline text-body-sm flex items-center gap-1 font-medium disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-sm">delete_sweep</span>
                      <span>ล้างตะกร้าสินค้าทั้งหมด</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Summary Sidebar */}
            <div className="lg:col-span-4 bg-surface-container-lowest rounded-lg border border-surface-variant shadow-sm p-space-lg flex flex-col gap-space-md sticky top-24">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface pb-space-xs border-b border-surface-variant">
                สรุปรายการจัดซื้อ
              </h3>

              <form className="flex items-center gap-2" onSubmit={handleApplyCoupon}>
                <input
                  type="text"
                  aria-label="รหัสคูปอง"
                  data-testid="coupon-input"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  placeholder="รหัสคูปอง"
                  className="min-w-0 flex-1 px-3 py-2 bg-surface-container-low border border-outline-variant/40 rounded-lg text-body-sm"
                />
                <button
                  type="submit"
                  data-testid="coupon-apply"
                  disabled={saving}
                  className="px-3 py-2 bg-surface-container hover:bg-surface-variant text-on-surface font-label-md font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  ใช้คูปอง
                </button>
              </form>

              <div className="flex flex-col gap-3 font-body-sm text-body-sm">
                <div className="flex justify-between text-on-surface-variant">
                  <span>ราคาสินค้ารวม (Subtotal)</span>
                  <span data-testid="cart-subtotal" data-value={cart.subtotal} className="font-code-sm text-on-surface font-semibold">
                    ฿{money(cart.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>คูปองที่ผูกไว้</span>
                  <span className="font-code-sm text-on-surface font-semibold">
                    <span data-testid="cart-coupon-code">{cart.coupon?.code ?? ''}</span>
                    {!cart.coupon && <span>ไม่มี</span>}
                  </span>
                </div>
                {cart.discount > 0 && (
                  <div className="flex justify-between text-on-surface-variant">
                    <span>ส่วนลดโดยประมาณ</span>
                    <span className="font-code-sm text-success font-semibold">-฿{money(cart.discount)}</span>
                  </div>
                )}
              </div>

              {/* รูปแบบการจัดส่ง (ใช้ตอน pressCheckout) */}
              <div className="flex flex-col gap-2 pt-2 border-t border-surface-variant">
                <label className="flex flex-col gap-1 font-label-md text-label-md text-on-surface">
                  <span>พื้นที่จัดส่ง</span>
                  <select
                    data-testid="zone-select"
                    value={zone}
                    onChange={e => setZone(e.target.value)}
                    className="px-3 py-2 bg-surface-container-low border border-outline-variant/40 rounded-lg text-body-sm"
                  >
                    {SHIPPING_ZONES.map(value => (
                      <option key={value} value={value}>{ZONE_LABELS[value] || value}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 font-label-md text-label-md text-on-surface">
                  <span>ความเร็วในการจัดส่ง</span>
                  <select
                    data-testid="speed-select"
                    value={speed}
                    onChange={e => setSpeed(e.target.value)}
                    className="px-3 py-2 bg-surface-container-low border border-outline-variant/40 rounded-lg text-body-sm"
                  >
                    {SHIPPING_SPEEDS.map(value => (
                      <option key={value} value={value}>{SPEED_LABELS[value] || value}</option>
                    ))}
                  </select>
                </label>
                <p className="font-body-sm text-body-sm text-on-surface-variant">ค่าจัดส่งและส่วนลดจริงคำนวณเมื่อกดชำระเงิน</p>
              </div>

              {/* FR-2.8: เปิดเมื่อมีรายการอย่างน้อย 1 รายการ (หน้านี้แสดงเฉพาะ stage ตะกร้า) */}
              <button
                type="button"
                data-testid="checkout-button"
                disabled={items.length === 0 || saving}
                onClick={handleCheckout}
                className="w-full mt-2 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3 rounded-lg font-semibold transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>ดำเนินการชำระเงิน</span>
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </main>
  );
};
