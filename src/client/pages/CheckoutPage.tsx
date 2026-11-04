import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { cancelOrderApi, checkoutApi, fetchOrderApi, payOrderApi } from '../services/api';
import { ORDER_STATUS, SHIPPING_SPEEDS, SHIPPING_ZONES, shippingFeeFor } from '../../config/business';
import { SPEED_LABELS, ZONE_LABELS } from '../constants';
import type { Order, PaymentResult } from '../types';

export const CheckoutPage: React.FC = () => {
  const {
    token,
    user,
    cart,
    currentOrder,
    setCurrentOrder,
    refreshCart,
    clearCart,
    setCurrentView,
    addToast,
    showApiError
  } = useApp();
  const [loading, setLoading] = useState(false);
  const [zone, setZone] = useState('inCity');
  const [speed, setSpeed] = useState('standard');

  const pendingOrder = currentOrder?.status === ORDER_STATUS.PENDING_PAYMENT ? currentOrder : null;
  const isEmpty = !pendingOrder && (cart?.items.length ?? 0) === 0;

  useEffect(() => {
    if (isEmpty) setCurrentView('cart');
  }, [isEmpty]);

  if (isEmpty) return null;

  // Before the order exists show the cart, afterwards show what the server actually saved
  const lines = pendingOrder
    ? (pendingOrder.items ?? []).map(item => ({
        id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        lineTotal: item.unit_price * item.quantity
      }))
    : (cart?.items ?? []).map(item => ({
        id: item.productId,
        name: item.name,
        quantity: item.quantity,
        lineTotal: item.lineTotal
      }));
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = pendingOrder?.subtotal ?? cart?.subtotal ?? 0;
  const discount = pendingOrder?.discount ?? cart?.discount ?? 0;
  const shippingFee = pendingOrder?.shipping_fee ??
    shippingFeeFor(cart?.totalWeightGram ?? 0, zone, speed, user?.memberTier ?? 'normal') ?? 0;
  const netTotal = pendingOrder?.net_total ?? subtotal - discount + shippingFee;

  const handleCheckout = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const data = await checkoutApi(token, zone, speed);
      setCurrentOrder(data.order);
    } catch (err: any) {
      const existingOrderId = err.details?.orderId;

      if (typeof existingOrderId === 'string') {
        await resumeOrder(token, existingOrderId);
      } else {
        showApiError(err, 'ไม่สามารถสร้างคำสั่งซื้อได้');
        await refreshCart();
      }
    } finally {
      setLoading(false);
    }
  };

  const resumeOrder = async (authToken: string, orderId: string) => {
    try {
      const data = await fetchOrderApi(authToken, orderId);
      setCurrentOrder(data.order);
      addToast('มีคำสั่งซื้อที่รอชำระเงินอยู่แล้ว กรุณาชำระเงินหรือยกเลิกก่อน', 'warning');
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถโหลดคำสั่งซื้อได้');
    }
  };

  const leaveToCart = async () => {
    setCurrentOrder(null);
    await refreshCart();
    setCurrentView('cart');
  };

  const handlePay = async (order: Order, result: PaymentResult) => {
    if (!token) return;
    setLoading(true);

    try {
      const data = await payOrderApi(token, order.id, result);

      if (result === 'success') {
        // Keep the stage at "completed" until the user continues shopping (GET /cart, OP-12)
        clearCart();
        setCurrentOrder(data.order);
        addToast('การชำระเงินและยืนยันคำสั่งซื้อสำเร็จ!', 'success');
        setCurrentView('order-confirmation');
      } else {
        addToast('ชำระเงินไม่สำเร็จ สินค้ายังอยู่ในตะกร้า', 'error');
      }
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถดำเนินการชำระเงินได้');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (order: Order) => {
    if (!token) return;
    setLoading(true);

    try {
      await cancelOrderApi(token, order.id);
      addToast(`ยกเลิกคำสั่งซื้อ ${order.id} แล้ว`, 'info');
      await leaveToCart();
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถยกเลิกคำสั่งซื้อได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
      <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col gap-space-lg">

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-sm pb-space-md border-b border-surface-variant">
          <div className="flex flex-col gap-space-xs">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              ตรวจสอบคำสั่งซื้อและการชำระเงิน
            </h1>
            <p className="font-body-md text-on-surface-variant">ยืนยันที่อยู่การจัดส่งและวิธีการชำระเงินสำหรับองค์กร</p>
          </div>
          <button
            type="button"
            onClick={() => pendingOrder ? handleCancel(pendingOrder) : setCurrentView('cart')}
            className="flex items-center gap-1 text-primary font-label-md font-semibold"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>กลับไปตะกร้าสินค้า</span>
          </button>
        </div>

        <div className="p-space-md rounded-lg border bg-surface-container-lowest text-on-surface shadow-sm flex items-start gap-space-md border-primary/30">
          <span className="material-symbols-outlined text-primary text-2xl shrink-0 mt-0.5">verified_user</span>
          <div className="flex-1">
            <div className="flex items-center gap-space-sm flex-wrap">
              <h4 className="font-headline-sm text-headline-sm font-bold">
                {pendingOrder ? `คำสั่งซื้อ #${pendingOrder.id}` : 'เลือกการจัดส่งเพื่อสร้างคำสั่งซื้อ'}
              </h4>
              <span className="font-code-sm text-code-sm px-2 py-0.5 rounded bg-success/10 text-success font-bold">
                {pendingOrder ? pendingOrder.status : 'READY'}
              </span>
            </div>
            <p className="font-body-sm text-on-surface-variant mt-1">
              {pendingOrder
                ? 'สร้างคำสั่งซื้อแล้ว กรุณายืนยันการชำระเงินหรือยกเลิกคำสั่งซื้อ'
                : 'ข้อมูลธุรกรรมจะถูกส่งและบันทึกในระบบบันทึกคำสั่งซื้อขององค์กรโดยอัตโนมัติ'}
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

              {pendingOrder ? (
                <p className="font-body-md text-on-surface">
                  {ZONE_LABELS[pendingOrder.zone] || pendingOrder.zone} · {SPEED_LABELS[pendingOrder.speed] || pendingOrder.speed}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                  <div className="flex flex-col gap-2">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">พื้นที่จัดส่ง</span>
                    {SHIPPING_ZONES.map(value => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer text-body-md text-on-surface">
                        <input
                          type="radio"
                          name="zone"
                          checked={zone === value}
                          onChange={() => setZone(value)}
                          className="accent-primary w-4 h-4"
                        />
                        <span>{ZONE_LABELS[value] || value}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">ความเร็วในการจัดส่ง</span>
                    {SHIPPING_SPEEDS.map(value => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer text-body-md text-on-surface">
                        <input
                          type="radio"
                          name="speed"
                          checked={speed === value}
                          onChange={() => setSpeed(value)}
                          className="accent-primary w-4 h-4"
                        />
                        <span>{SPEED_LABELS[value] || value}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-surface-container-lowest p-space-lg rounded-lg border border-surface-variant shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center gap-2 border-b border-surface-variant pb-space-sm">
                <span className="material-symbols-outlined text-primary text-xl">local_shipping</span>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">ข้อมูลสถานที่จัดส่งและใบกำกับภาษี</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">ชื่อบริษัท / องค์กร</label>
                  <input type="text" defaultValue="Nexus Enterprise Co., Ltd." className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/40 rounded-lg text-body-md" required />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">เลขประจำตัวผู้เสียภาษี</label>
                  <input type="text" defaultValue="0105564088921" className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/40 rounded-lg text-body-md" required />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">เบอร์โทรศัพท์ติดต่อ</label>
                  <input type="tel" defaultValue="02-890-1234" className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/40 rounded-lg text-body-md" required />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">ที่อยู่จัดส่งสินค้า</label>
                  <textarea rows={2} defaultValue="อาคารเน็กซัสทาวเวอร์ ชั้น 18 เลขที่ 88 ถนนสาทรเหนือ แขวงสีลม เขตบางรัก กรุงเทพมหานคร 10500" className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant/40 rounded-lg text-body-md" required />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-lg rounded-lg border border-surface-variant shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center gap-2 border-b border-surface-variant pb-space-sm">
                <span className="material-symbols-outlined text-primary text-xl">payments</span>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">วิธีการชำระเงิน (Payment Method)</h3>
              </div>

              <div className="flex flex-col gap-3">
                <label className="flex items-center justify-between p-3.5 border border-primary bg-primary/5 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input type="radio" name="payment" defaultChecked className="accent-primary w-4 h-4" />
                    <div>
                      <span className="font-label-md font-bold block text-on-surface">โอนเงินผ่านบัญชีธนาคารองค์กร / EDI</span>
                      <span className="font-body-sm text-on-surface-variant">ชำระเงินตามเงื่อนไขเครดิตเทอม 30 วัน</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-primary">account_balance</span>
                </label>

                <label className="flex items-center justify-between p-3.5 border border-outline-variant/40 rounded-lg cursor-pointer hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-3">
                    <input type="radio" name="payment" className="accent-primary w-4 h-4" />
                    <div>
                      <span className="font-label-md font-bold block text-on-surface">บัตรเครดิตนิติบุคคล (Corporate Credit Card)</span>
                      <span className="font-body-sm text-on-surface-variant">ตัดบัตรออนไลน์ทันที ปลอดภัย 100%</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-secondary">credit_card</span>
                </label>
              </div>
            </div>

          </div>

          <div className="lg:col-span-5 bg-surface-container-lowest p-space-lg rounded-lg border border-surface-variant shadow-sm flex flex-col gap-space-md sticky top-24">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface pb-space-xs border-b border-surface-variant">
              สรุปคำสั่งซื้อ ({itemCount} รายการ)
            </h3>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-2 pr-1">
              {lines.map(line => (
                <div key={line.id} className="flex items-center justify-between py-1.5 border-b border-surface-variant/40 text-body-sm">
                  <div className="flex items-center gap-2 overflow-hidden pr-2">
                    <span className="font-code-sm text-primary font-bold">x{line.quantity}</span>
                    <span className="truncate font-medium text-on-surface">{line.name}</span>
                  </div>
                  <span className="font-code-sm font-semibold shrink-0 text-on-surface">
                    ฿{line.lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-surface-variant font-body-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>ราคาสินค้ารวม</span>
                <span className="font-code-sm font-semibold text-on-surface">
                  ฿{subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-on-surface-variant">
                  <span>ส่วนลดคูปอง</span>
                  <span className="font-code-sm text-success font-semibold">
                    -฿{discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-on-surface-variant">
                <span>ค่าจัดส่ง</span>
                <span className="font-code-sm font-semibold text-on-surface">
                  ฿{shippingFee.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-3 border-t border-surface-variant flex justify-between items-baseline">
                <span className="font-label-md text-headline-sm font-bold text-on-surface">ยอดสุทธิที่ต้องชำระ</span>
                <span className="font-code-md text-headline-md font-bold text-primary">
                  ฿{netTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {pendingOrder ? (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handlePay(pendingOrder, 'success')}
                  className="w-full mt-2 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3.5 rounded-lg font-semibold transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-xl">check_circle</span>
                  <span>{loading ? 'กำลังประมวลผลธุรกรรม...' : 'ยืนยันชำระเงิน'}</span>
                  {loading && <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handlePay(pendingOrder, 'fail')}
                    className="px-3 py-2.5 bg-surface-container hover:bg-surface-variant text-on-surface font-label-md font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    จำลองชำระเงินไม่สำเร็จ
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleCancel(pendingOrder)}
                    className="px-3 py-2.5 text-error border border-error/30 hover:bg-error-container/20 font-label-md font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    ยกเลิกคำสั่งซื้อ
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleCheckout}
                className="w-full mt-2 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3.5 rounded-lg font-semibold transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-xl">receipt_long</span>
                <span>{loading ? 'กำลังสร้างคำสั่งซื้อ...' : 'สร้างคำสั่งซื้อ'}</span>
                {loading && <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>}
              </button>
            )}
          </div>

        </div>

      </div>
    </main>
  );
};
