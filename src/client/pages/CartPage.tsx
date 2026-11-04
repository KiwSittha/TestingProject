import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { applyCouponApi, removeCartItemApi, updateCartItemApi } from '../services/api';
import { DEFAULT_PRODUCT_IMAGE } from '../constants';
import type { Cart } from '../types';

export const CartPage: React.FC = () => {
  const { token, cart, cartCount, applyCart, refreshCart, showApiError, addToast, setCurrentView } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [couponCode, setCouponCode] = useState('');

  const items = cart?.items ?? [];

  useEffect(() => {
    refreshCart().finally(() => setLoading(false));
  }, []);

  const runCartAction = async (action: (token: string) => Promise<{ cart: Cart }>, fallback: string) => {
    if (!token) return false;
    setSaving(true);

    try {
      const data = await action(token);
      applyCart(data.cart);
      return true;
    } catch (err: any) {
      showApiError(err, fallback);
      // The server may have changed the cart even on failure, e.g. it drops a coupon that no longer applies
      await refreshCart();
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleChangeQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemove(productId);
      return;
    }
    runCartAction(t => updateCartItemApi(t, productId, quantity), 'ไม่สามารถแก้ไขจำนวนสินค้าได้');
  };

  const handleRemove = (productId: string) => {
    runCartAction(t => removeCartItemApi(t, productId), 'ไม่สามารถลบสินค้าออกจากตะกร้าได้');
  };

  // The API has no "clear cart" endpoint, so remove items one by one
  const handleClearCart = () => {
    runCartAction(async t => {
      let latest = { cart: cart as Cart };
      for (const item of items) {
        latest = await removeCartItemApi(t, item.productId);
      }
      return latest;
    }, 'ไม่สามารถล้างตะกร้าสินค้าได้');
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim();
    if (!code) return;

    const applied = await runCartAction(t => applyCouponApi(t, code), 'ไม่สามารถใช้คูปองได้');
    if (applied) {
      setCouponCode('');
      addToast(`ใช้คูปอง ${code} เรียบร้อยแล้ว`, 'success');
    }
  };

  return (
    <main className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
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
              <span>{cartCount} รายการ</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              ตะกร้าสินค้าสำหรับองค์กร
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setCurrentView('products')}
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
        ) : !cart || items.length === 0 ? (
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
              onClick={() => setCurrentView('products')}
              className="mt-2 bg-primary hover:bg-primary-container text-on-primary font-label-md px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              เรียกดูแคตตาล็อกสินค้า
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

            {/* Items List */}
            <div className="lg:col-span-8 flex flex-col gap-space-md">
              <div className="bg-surface-container-lowest rounded-lg border border-surface-variant shadow-sm divide-y divide-surface-variant overflow-hidden">
                {items.map(item => {
                  const itemSubtotal = item.lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 });
                  const unitPrice = item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 });

                  return (
                    <div key={item.productId} className="p-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
                      <div className="flex items-center gap-space-md flex-1">
                        <img
                          src={DEFAULT_PRODUCT_IMAGE}
                          alt={item.name}
                          className="w-16 h-16 rounded-lg object-cover bg-surface-container border border-surface-variant shrink-0"
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="font-code-sm text-code-sm text-on-surface-variant">{item.productId}</span>
                          <h4 className="font-headline-sm text-label-md text-on-surface font-semibold line-clamp-1">{item.name}</h4>
                          <span className="font-code-sm text-code-sm text-secondary">ราคาต่อหน่วย: ฿{unitPrice}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-space-md w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center border border-outline-variant/50 rounded-lg overflow-hidden bg-surface-container-low">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleChangeQuantity(item.productId, item.quantity - 1)}
                            className="p-2 hover:bg-surface-variant text-on-surface flex items-center justify-center transition-colors disabled:opacity-60"
                          >
                            <span className="material-symbols-outlined text-sm">remove</span>
                          </button>
                          <span className="px-3 font-code-md text-code-md font-bold text-on-surface">{item.quantity}</span>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleChangeQuantity(item.productId, item.quantity + 1)}
                            className="p-2 hover:bg-surface-variant text-on-surface flex items-center justify-center transition-colors disabled:opacity-60"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                          </button>
                        </div>

                        <div className="text-right min-w-[100px]">
                          <span className="font-code-md text-body-lg text-primary font-bold">฿{itemSubtotal}</span>
                        </div>

                        <button
                          type="button"
                          title="ลบรายการ"
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
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  placeholder="รหัสคูปอง"
                  className="min-w-0 flex-1 px-3 py-2 bg-surface-container-low border border-outline-variant/40 rounded-lg text-body-sm"
                />
                <button
                  type="submit"
                  disabled={saving || !couponCode.trim()}
                  className="px-3 py-2 bg-surface-container hover:bg-surface-variant text-on-surface font-label-md font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  ใช้คูปอง
                </button>
              </form>

              <div className="flex flex-col gap-3 font-body-sm text-body-sm">
                <div className="flex justify-between text-on-surface-variant">
                  <span>ราคาสินค้ารวม (Subtotal)</span>
                  <span className="font-code-sm text-on-surface font-semibold">
                    ฿{cart.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {cart.coupon && (
                  <div className="flex justify-between text-on-surface-variant">
                    <span>ส่วนลดคูปอง {cart.coupon.code} ({cart.coupon.percent}%)</span>
                    <span className="font-code-sm text-success font-semibold">
                      -฿{cart.discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-on-surface-variant">
                  <span>ค่าบริการจัดส่ง (Shipping)</span>
                  <span className="font-code-sm text-on-surface font-semibold">คำนวณตอนชำระเงิน</span>
                </div>

                <div className="pt-3 border-t border-surface-variant flex justify-between items-baseline">
                  <span className="font-label-md text-label-md font-bold text-on-surface">ยอดรวมก่อนค่าจัดส่ง</span>
                  <span className="font-code-md text-headline-md font-bold text-primary">
                    ฿{cart.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentView('checkout')}
                className="w-full mt-2 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3 rounded-lg font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
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
