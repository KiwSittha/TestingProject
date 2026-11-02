import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fetchOrderApi, fetchOrdersApi } from '../services/api';
import { ORDER_STATUS } from '../../config/business';
import { ORDER_STATUS_BADGES, SPEED_LABELS, ZONE_LABELS, formatOrderDate } from '../constants';
import type { Order } from '../types';

const shippingLabel = (order: Order) =>
  `${ZONE_LABELS[order.zone] || order.zone} · ${SPEED_LABELS[order.speed] || order.speed}`;

export const OrderHistoryPage: React.FC = () => {
  const { token, addToast, showApiError, setCurrentOrder, setCurrentView } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadOrders = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const data = await fetchOrdersApi(token);
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Fetch orders error:', err);
      setErrorMsg(err.message || 'ไม่สามารถดึงประวัติคำสั่งซื้อได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [token]);

  const handleResumePayment = async (orderId: string) => {
    if (!token) return;

    try {
      const data = await fetchOrderApi(token, orderId);
      setCurrentOrder(data.order);
      setCurrentView('checkout');
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถโหลดคำสั่งซื้อได้');
    }
  };

  const handleExportCSV = () => {
    if (orders.length === 0) {
      addToast('ไม่มีข้อมูลคำสั่งซื้อสำหรับส่งออก', 'warning');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Order ID,Date,Shipping,Total (THB),Status\n";

    orders.forEach(o => {
      csvContent += `"${o.id}","${formatOrderDate(o)}","${shippingLabel(o)}","${o.net_total}","${o.status}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders_requisition_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('ส่งออกไฟล์ CSV คำสั่งซื้อเรียบร้อยแล้ว', 'success');
  };

  const handlePrintInvoice = (orderId: string) => {
    addToast(`พิมพ์เอกสารใบกำกับภาษีสำหรับคำสั่งซื้อ ${orderId}`, 'info');
    window.print();
  };

  return (
    <main className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
      <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col gap-space-lg">

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-lg shadow-sm border border-surface-variant">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-sm">
              <span className="inline-flex items-center justify-center p-1.5 rounded bg-primary-fixed text-primary">
                <span className="material-symbols-outlined text-[20px]">inventory_2</span>
              </span>
              <span className="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider">สมุดทะเบียนคำสั่งซื้อ (Requisition Ledger)</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">ประวัติคำสั่งซื้อและการจัดซื้อของฉัน</h1>
            <p className="font-body-md text-on-surface-variant">จัดการ ตรวจสอบ และติดตามการจัดซื้อระดับองค์กร โลจิสติกส์การจัดส่ง และเอกสารใบกำกับภาษี</p>
          </div>

          <div className="flex items-center gap-space-sm flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-space-xs bg-surface-container text-on-surface font-label-md px-space-md py-2.5 rounded-lg hover:bg-surface-variant transition-colors shadow-sm font-semibold border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>ส่งออกข้อมูลคำสั่งซื้อ (.CSV)</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-6 bg-error-container text-on-error-container rounded-lg border border-error/20 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-2xl">error</span>
              <h3 className="font-headline-sm font-bold">เกิดข้อผิดพลาดในการโหลดคำสั่งซื้อ</h3>
            </div>
            <p className="font-body-sm">{errorMsg}</p>
            <button
              onClick={loadOrders}
              className="self-start mt-2 px-4 py-2 bg-error text-on-error font-label-md rounded-lg hover:bg-error/90 transition-colors"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {!errorMsg && <div className="bg-surface-container-lowest rounded-lg border border-surface-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant font-label-md text-label-sm text-on-surface-variant uppercase tracking-wider">
                  <th className="p-4">รหัสคำสั่งซื้อ</th>
                  <th className="p-4">วันที่ทำรายการ</th>
                  <th className="p-4">การจัดส่ง</th>
                  <th className="p-4 text-right">ยอดรวมสุทธิ</th>
                  <th className="p-4 text-center">สถานะคำสั่งซื้อ</th>
                  <th className="p-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant font-body-sm text-body-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-4xl block mb-2 animate-spin">progress_activity</span>
                      กำลังโหลดประวัติคำสั่งซื้อ...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-4xl block mb-2">receipt_long</span>
                      ยังไม่มีประวัติคำสั่งซื้อในระบบ
                    </td>
                  </tr>
                ) : (
                  orders.map(ord => {
                    const formattedTotal = Number(ord.net_total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });

                    return (
                      <tr key={ord.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="p-4 font-code-md font-bold text-primary">
                          {ord.id}
                        </td>
                        <td className="p-4 text-on-surface font-medium">
                          {formatOrderDate(ord)}
                        </td>
                        <td className="p-4 text-on-surface">
                          {shippingLabel(ord)}
                        </td>
                        <td className="p-4 text-right font-code-md font-bold text-on-surface">
                          ฿{formattedTotal}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-code-sm text-code-sm font-semibold border ${ORDER_STATUS_BADGES[ord.status] || 'bg-success/10 text-success border-success/30'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {ord.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {ord.status === ORDER_STATUS.PENDING_PAYMENT ? (
                            <button
                              type="button"
                              onClick={() => handleResumePayment(ord.id)}
                              className="text-primary hover:underline font-label-md font-semibold inline-flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">payments</span>
                              <span>ชำระเงินต่อ</span>
                            </button>
                          ) : ord.status === ORDER_STATUS.PAID ? (
                            <button
                              type="button"
                              onClick={() => handlePrintInvoice(ord.id)}
                              className="text-primary hover:underline font-label-md font-semibold inline-flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">print</span>
                              <span>ใบกำกับภาษี</span>
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>}

      </div>
    </main>
  );
};
