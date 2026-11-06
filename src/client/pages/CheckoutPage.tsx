import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { cancelOrderApi, fetchOrderApi, payOrderApi } from '../services/api';
import { SPEED_LABELS, ZONE_LABELS } from '../constants';
import type { Order, PaymentResult } from '../types';

const money = (value: number) => value.toLocaleString('th-TH', { minimumFractionDigits: 2 });

// หน้าของ stage `ชำระเงิน` (page-checkout) แสดงออเดอร์ที่รอชำระ และปุ่มของ payment gateway จำลอง (DC-3.3)
export const CheckoutPage: React.FC = () => {
  const {
    token,
    stageOrderId,
    setStage,
    refreshCart,
    clearCart,
    navigate,
    addToast,
    showApiError
  } = useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !stageOrderId) return;
    let cancelled = false;

    fetchOrderApi(token, stageOrderId)
      .then(data => {
        if (!cancelled) setOrder(data.order);
      })
      .catch(err => showApiError(err, 'ไม่สามารถโหลดคำสั่งซื้อได้'));

    return () => {
      cancelled = true;
    };
  }, [token, stageOrderId]);

  // OP-10 paySuccess / OP-11 payFail
  const handlePay = async (current: Order, result: PaymentResult) => {
    if (!token) return;
    setLoading(true);

    try {
      const data = await payOrderApi(token, current.id, result);

      if (result === 'success') {
        // FR-6.1: ตะกร้าว่าง stage สำเร็จ จนกว่าจะกด continueShopping
        clearCart();
        setStage('สำเร็จ', current.id);
        addToast('การชำระเงินและยืนยันคำสั่งซื้อสำเร็จ!', 'success');
        navigate('/success');
      } else {
        // FR-6.2: คงออเดอร์และ stage เดิม แสดงข้อความตามที่ FR-6.2.1 กำหนด
        addToast(data.message || 'การชำระเงินล้มเหลว กรุณาลองใหม่', 'info');
      }
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถดำเนินการชำระเงินได้');
    } finally {
      setLoading(false);
    }
  };

  // OP-9 cancelCheckout: กลับไปตะกร้าพร้อมรายการเดิม (FR-7)
  const handleCancel = async (current: Order) => {
    if (!token) return;
    setLoading(true);

    try {
      await cancelOrderApi(token, current.id);
      setStage('ตะกร้า', null);
      await refreshCart();
      addToast(`ยกเลิกคำสั่งซื้อ ${current.id} แล้ว`, 'info');
      navigate('/cart');
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถยกเลิกคำสั่งซื้อได้');
    } finally {
      setLoading(false);
    }
  };

  if (!order) {
    return (
      <main data-testid="page-checkout" className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
        <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col items-center justify-center py-16 gap-3">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
          <p className="font-body-md text-on-surface-variant font-medium">กำลังโหลดคำสั่งซื้อ...</p>
        </div>
      </main>
    );
  }

  const lines = order.items ?? [];
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <main data-testid="page-checkout" className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
      <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col gap-space-lg">

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-sm pb-space-md border-b border-surface-variant">
          <div className="flex flex-col gap-space-xs">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              ตรวจสอบคำสั่งซื้อและการชำระเงิน
            </h1>
            <p className="font-body-md text-on-surface-variant">ยืนยันการชำระเงิน หรือยกเลิกเพื่อกลับไปแก้ไขตะกร้า</p>
          </div>
        </div>

        <div className="p-space-md rounded-lg border bg-surface-container-lowest text-on-surface shadow-sm flex items-start gap-space-md border-primary/30">
          <span className="material-symbols-outlined text-primary text-2xl shrink-0 mt-0.5">verified_user</span>
          <div className="flex-1">
            <div className="flex items-center gap-space-sm flex-wrap">
              <h4 className="font-headline-sm text-headline-sm font-bold">
                คำสั่งซื้อ #<span data-testid="checkout-order-id">{order.id}</span>
              </h4>
              <span className="font-code-sm text-code-sm px-2 py-0.5 rounded bg-warning/10 text-on-surface font-bold">
                {order.status}
              </span>
            </div>
            <p className="font-body-sm text-on-surface-variant mt-1">
              สร้างคำสั่งซื้อแล้ว กรุณายืนยันการชำระเงินหรือยกเลิกคำสั่งซื้อ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <div className="lg:col-span-7 flex flex-col gap-space-lg">

            <div className="bg-surface-container-lowest p-space-lg rounded-lg border border-surface-variant shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center gap-2 border-b border-surface-variant pb-space-sm">
                <span className="material-symbols-outlined text-primary text-xl">route</span>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">รูปแบบการจัดส่ง</h3>
              </div>
              <p className="font-body-md text-on-surface">
                {ZONE_LABELS[order.zone] || order.zone} · {SPEED_LABELS[order.speed] || order.speed}
              </p>
            </div>

            <div className="bg-surface-container-lowest p-space-lg rounded-lg border border-surface-variant shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center gap-2 border-b border-surface-variant pb-space-sm">
                <span className="material-symbols-outlined text-primary text-xl">payments</span>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Payment gateway (จำลอง)</h3>
              </div>
              <p className="font-body-sm text-on-surface-variant">
                ปุ่มด้านล่างจำลองผลที่ payment gateway ส่งกลับมา
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="gateway-pay-success"
                  disabled={loading}
                  onClick={() => handlePay(order, 'success')}
                  className="px-3 py-3 bg-primary hover:bg-primary-container text-on-primary font-label-md font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-xl">check_circle</span>
                  <span>ยืนยันชำระเงิน</span>
                </button>
                <button
                  type="button"
                  data-testid="gateway-pay-fail"
                  disabled={loading}
                  onClick={() => handlePay(order, 'fail')}
                  className="px-3 py-3 bg-surface-container hover:bg-surface-variant text-on-surface font-label-md font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  จำลองชำระเงินไม่สำเร็จ
                </button>
              </div>
            </div>

          </div>

          <div className="lg:col-span-5 bg-surface-container-lowest p-space-lg rounded-lg border border-surface-variant shadow-sm flex flex-col gap-space-md sticky top-24">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface pb-space-xs border-b border-surface-variant">
              สรุปคำสั่งซื้อ ({itemCount} ชิ้น)
            </h3>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-2 pr-1">
              {lines.map(line => (
                <div key={line.product_id} className="flex items-center justify-between py-1.5 border-b border-surface-variant/40 text-body-sm">
                  <div className="flex items-center gap-2 overflow-hidden pr-2">
                    <span className="font-code-sm text-primary font-bold">x{line.quantity}</span>
                    <span className="truncate font-medium text-on-surface">{line.product_name}</span>
                  </div>
                  <span className="font-code-sm font-semibold shrink-0 text-on-surface">
                    ฿{money(line.unit_price * line.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-surface-variant font-body-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>ราคาสินค้ารวม</span>
                <span data-testid="checkout-subtotal" data-value={order.subtotal} className="font-code-sm font-semibold text-on-surface">
                  ฿{money(order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>ส่วนลด{order.coupon_code ? ` (คูปอง ${order.coupon_code})` : ''}</span>
                <span data-testid="checkout-discount" data-value={order.discount} className="font-code-sm text-success font-semibold">
                  -฿{money(order.discount)}
                </span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>ค่าจัดส่ง</span>
                <span data-testid="checkout-shipping" data-value={order.shipping_fee} className="font-code-sm font-semibold text-on-surface">
                  ฿{money(order.shipping_fee)}
                </span>
              </div>

              <div className="pt-3 border-t border-surface-variant flex justify-between items-baseline">
                <span className="font-label-md text-headline-sm font-bold text-on-surface">ยอดสุทธิที่ต้องชำระ</span>
                <span data-testid="checkout-total" data-value={order.net_total} className="font-code-md text-headline-md font-bold text-primary">
                  ฿{money(order.net_total)}
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="cancel-checkout-button"
              disabled={loading}
              onClick={() => handleCancel(order)}
              className="w-full px-3 py-2.5 text-error border border-error/30 hover:bg-error-container/20 font-label-md font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              ยกเลิกคำสั่งซื้อ
            </button>
          </div>

        </div>

      </div>
    </main>
  );
};
