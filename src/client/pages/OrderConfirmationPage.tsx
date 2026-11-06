import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { continueShoppingApi, fetchOrderApi } from '../services/api';
import { formatOrderDate } from '../constants';
import type { Order } from '../types';

const money = (value: number) => value.toLocaleString('th-TH', { minimumFractionDigits: 2 });

// หน้าของ stage `สำเร็จ` (page-success) แสดงจนกว่าจะกด continueShopping (FR-6.4)
export const OrderConfirmationPage: React.FC = () => {
  const { token, stageOrderId, setStage, applyCart, navigate, showApiError } = useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [leaving, setLeaving] = useState(false);

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

  // OP-12 continueShopping: กลับไป stage ตะกร้า
  const handleContinueShopping = async () => {
    if (!token) return;
    setLeaving(true);

    try {
      const data = await continueShoppingApi(token);
      applyCart(data.cart);
      setStage('ตะกร้า', null);
      navigate('/cart');
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถกลับไปเลือกซื้อสินค้าได้');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <main data-testid="page-success" className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
      <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col gap-space-lg">

        <div className="w-full bg-surface-container-lowest rounded-lg p-space-lg shadow-sm border border-surface-variant flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
          <div className="flex items-start gap-space-md">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center shrink-0 text-success">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <div className="flex flex-col">
              <h1 className="font-headline-sm text-headline-md font-bold text-on-surface">
                ชำระเงินสำเร็จ! คำสั่งซื้อ #<span data-testid="success-order-id">{stageOrderId}</span> ได้รับการยืนยันแล้ว
              </h1>
            </div>
          </div>
        </div>

        {order && (
          <>
            <div className="w-full bg-surface-container-lowest rounded-lg p-space-md shadow-sm border border-surface-variant flex flex-col gap-2">
              {(order.items ?? []).map(line => (
                <div
                  key={line.product_id}
                  data-testid={`success-line-${line.product_id}`}
                  className="flex items-center justify-between py-1.5 border-b border-surface-variant/40 text-body-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-code-sm text-primary font-bold">x{line.quantity}</span>
                    <span className="font-medium text-on-surface">{line.product_name}</span>
                  </div>
                  <span className="font-code-sm font-semibold text-on-surface">฿{money(line.unit_price * line.quantity)}</span>
                </div>
              ))}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 font-body-sm">
                <div className="flex flex-col">
                  <span className="text-on-surface-variant">ราคาสินค้ารวม</span>
                  <span data-testid="success-subtotal" data-value={order.subtotal} className="font-code-sm font-semibold">฿{money(order.subtotal)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-on-surface-variant">ส่วนลด</span>
                  <span data-testid="success-discount" data-value={order.discount} className="font-code-sm font-semibold text-success">-฿{money(order.discount)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-on-surface-variant">ค่าจัดส่ง</span>
                  <span data-testid="success-shipping" data-value={order.shipping_fee} className="font-code-sm font-semibold">฿{money(order.shipping_fee)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-on-surface-variant">ยอดรวมสุทธิ</span>
                  <span data-testid="success-total" data-value={order.net_total} className="font-code-md text-body-lg font-bold text-primary">฿{money(order.net_total)}</span>
                </div>
              </div>
            </div>

            <div className="w-full bg-surface-container-lowest rounded-lg p-space-md shadow-sm border border-surface-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
              <div className="flex items-center gap-space-md">
                <div className="flex flex-col">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">วันที่ทำรายการ</span>
                  <span className="font-body-md font-semibold text-on-surface">{formatOrderDate(order)}</span>
                </div>
                <div className="h-8 w-px bg-surface-variant"></div>
                <div className="flex flex-col">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">สถานะการชำระเงิน</span>
                  <span className="font-body-md font-semibold text-success flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-success"></span>
                    {order.status}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="continue-shopping-button"
            disabled={leaving}
            onClick={handleContinueShopping}
            className="px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-label-md font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">storefront</span>
            <span>เลือกซื้อสินค้าต่อ</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="px-4 py-2.5 bg-surface-container hover:bg-surface-variant text-on-surface font-label-md font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">receipt_long</span>
            <span>ไปที่ประวัติคำสั่งซื้อ</span>
          </button>
        </div>

      </div>
    </main>
  );
};
