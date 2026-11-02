import React from 'react';
import { useApp } from '../context/AppContext';
import { formatOrderDate } from '../constants';

export const OrderConfirmationPage: React.FC = () => {
  const { currentOrder, refreshCart, setCurrentView } = useApp();

  if (!currentOrder) return null;

  const formattedTotal = Number(currentOrder.net_total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });

  // OP-12 continueShopping
  const handleContinueShopping = () => {
    refreshCart();
    setCurrentView('products');
  };

  return (
    <main className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
      <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col gap-space-lg">

        <div className="w-full bg-surface-container-lowest rounded-lg p-space-lg shadow-sm border border-surface-variant flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
          <div className="flex items-start gap-space-md">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center shrink-0 text-success">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <div className="flex flex-col">
              <h1 className="font-headline-sm text-headline-md font-bold text-on-surface">
                ชำระเงินสำเร็จ! คำสั่งซื้อ #{currentOrder.id} ได้รับการยืนยันแล้ว
              </h1>
            </div>
          </div>
        </div>

        <div className="w-full bg-surface-container-lowest rounded-lg p-space-md shadow-sm border border-surface-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md">
            <div className="flex flex-col">
              <span className="font-code-sm text-code-sm text-on-surface-variant">วันที่ทำรายการ</span>
              <span className="font-body-md font-semibold text-on-surface">{formatOrderDate(currentOrder)}</span>
            </div>
            <div className="h-8 w-px bg-surface-variant"></div>
            <div className="flex flex-col">
              <span className="font-code-sm text-code-sm text-on-surface-variant">สถานะการชำระเงิน</span>
              <span className="font-body-md font-semibold text-success flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success"></span>
                ชำระเงินแล้ว
              </span>
            </div>
            <div className="h-8 w-px bg-surface-variant"></div>
            <div className="flex flex-col">
              <span className="font-code-sm text-code-sm text-on-surface-variant">ยอดรวมสุทธิ</span>
              <span className="font-code-md text-body-lg font-bold text-primary">฿{formattedTotal}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleContinueShopping}
              className="px-4 py-2.5 bg-surface-container hover:bg-surface-variant text-on-surface font-label-md font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">storefront</span>
              <span>เลือกซื้อสินค้าต่อ</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('order-history')}
              className="px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-label-md font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">receipt_long</span>
              <span>ไปที่ประวัติคำสั่งซื้อ</span>
            </button>
          </div>
        </div>

      </div>
    </main>
  );
};
