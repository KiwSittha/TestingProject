import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fetchOrderApi } from '../services/api';
import { ORDER_STATUS_BADGES, SPEED_LABELS, ZONE_LABELS, formatOrderDate } from '../constants';
import type { Order } from '../types';

const money = (value: number) => value.toLocaleString('th-TH', { minimumFractionDigits: 2 });

// OP-14 viewOrder (page-order-detail)
// ออเดอร์ที่ไม่มีอยู่และออเดอร์ของผู้อื่นได้ ORDER_NOT_FOUND เหมือนกัน (FR-0.5.2)
export const OrderDetailPage: React.FC<{ orderId: string }> = ({ orderId }) => {
  const { token, navigate, showApiError } = useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not-found'>('loading');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setState('loading');
    setOrder(null);

    fetchOrderApi(token, orderId)
      .then(data => {
        if (cancelled) return;
        setOrder(data.order);
        setState('ready');
      })
      .catch(err => {
        if (cancelled) return;
        showApiError(err, 'ไม่สามารถโหลดคำสั่งซื้อได้');
        setState('not-found');
      });

    return () => {
      cancelled = true;
    };
  }, [token, orderId]);

  return (
    <main data-testid="page-order-detail" className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
      <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col gap-space-lg">

        <div className="flex items-end justify-between pb-space-md border-b border-surface-variant">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">รายละเอียดคำสั่งซื้อ</h1>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="flex items-center gap-1 text-primary font-label-md font-semibold"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>กลับไปประวัติคำสั่งซื้อ</span>
          </button>
        </div>

        {state === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
            <p className="font-body-md text-on-surface-variant font-medium">กำลังโหลดคำสั่งซื้อ...</p>
          </div>
        )}

        {state === 'not-found' && (
          <div className="w-full bg-surface-container-lowest rounded-lg p-16 border border-surface-variant text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">search_off</span>
            <p className="font-body-lg text-on-surface">ไม่พบคำสั่งซื้อนี้</p>
          </div>
        )}

        {state === 'ready' && order && (
          <div className="bg-surface-container-lowest rounded-lg border border-surface-variant shadow-sm p-space-lg flex flex-col gap-space-md">
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div className="flex flex-col">
                <span className="font-code-sm text-code-sm text-on-surface-variant">รหัสคำสั่งซื้อ</span>
                <span data-testid="order-detail-id" className="font-code-md font-bold text-primary">{order.id}</span>
              </div>
              <span
                data-testid="order-detail-status"
                data-status={order.status}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-code-sm text-code-sm font-semibold border ${ORDER_STATUS_BADGES[order.status] || ''}`}
              >
                {order.status}
              </span>
            </div>

            <p className="font-body-sm text-on-surface-variant">
              {formatOrderDate(order)} · {ZONE_LABELS[order.zone] || order.zone} · {SPEED_LABELS[order.speed] || order.speed}
              {order.coupon_code ? ` · คูปอง ${order.coupon_code}` : ''}
            </p>

            <table className="w-full text-left border-collapse font-body-sm text-body-sm">
              <thead>
                <tr className="border-b border-surface-variant text-on-surface-variant">
                  <th className="py-2">สินค้า</th>
                  <th className="py-2 text-right">ราคาต่อหน่วย</th>
                  <th className="py-2 text-right">จำนวน</th>
                  <th className="py-2 text-right">รวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant">
                {(order.items ?? []).map(line => (
                  <tr key={line.product_id} data-testid={`order-line-${line.product_id}`}>
                    <td className="py-2">{line.product_name}</td>
                    <td className="py-2 text-right">
                      <span data-testid="order-line-unit-price" data-value={line.unit_price}>฿{money(line.unit_price)}</span>
                    </td>
                    <td className="py-2 text-right">
                      <span data-testid="order-line-qty" data-value={line.quantity}>{line.quantity}</span>
                    </td>
                    <td className="py-2 text-right">฿{money(line.unit_price * line.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col gap-2 pt-2 border-t border-surface-variant font-body-sm max-w-sm self-end w-full">
              <div className="flex justify-between">
                <span>ราคาสินค้ารวม</span>
                <span data-testid="order-detail-subtotal" data-value={order.subtotal}>฿{money(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>ส่วนลด</span>
                <span data-testid="order-detail-discount" data-value={order.discount}>-฿{money(order.discount)}</span>
              </div>
              <div className="flex justify-between">
                <span>ค่าจัดส่ง</span>
                <span data-testid="order-detail-shipping" data-value={order.shipping_fee}>฿{money(order.shipping_fee)}</span>
              </div>
              <div className="flex justify-between font-bold text-primary">
                <span>ยอดสุทธิ</span>
                <span data-testid="order-detail-total" data-value={order.net_total}>฿{money(order.net_total)}</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
};
