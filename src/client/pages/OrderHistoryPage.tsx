import React from 'react';
import { useApp } from '../context/AppContext';

export const OrderHistoryPage: React.FC = () => {
  const { orders, addToast } = useApp();

  const handleExportCSV = () => {
    if (orders.length === 0) {
      addToast('ไม่มีข้อมูลคำสั่งซื้อสำหรับส่งออก', 'warning');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Order ID,Date,Items Count,Total (THB),Status\n";

    orders.forEach(o => {
      csvContent += `"${o.id}","${o.date}","${o.itemsCount}","${o.total}","${o.status}"\n`;
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

        <div className="bg-surface-container-lowest rounded-lg border border-surface-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant font-label-md text-label-sm text-on-surface-variant uppercase tracking-wider">
                  <th className="p-4">รหัสคำสั่งซื้อ</th>
                  <th className="p-4">วันที่ทำรายการ</th>
                  <th className="p-4">จำนวนรายการ</th>
                  <th className="p-4 text-right">ยอดรวมสุทธิ</th>
                  <th className="p-4 text-center">สถานะคำสั่งซื้อ</th>
                  <th className="p-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant font-body-sm text-body-sm">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-4xl block mb-2">receipt_long</span>
                      ยังไม่มีประวัติคำสั่งซื้อในระบบ
                    </td>
                  </tr>
                ) : (
                  orders.map(ord => {
                    const formattedTotal = Number(ord.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
                    
                    return (
                      <tr key={ord.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="p-4 font-code-md font-bold text-primary">
                          {ord.id}
                        </td>
                        <td className="p-4 text-on-surface font-medium">
                          {ord.date}
                        </td>
                        <td className="p-4 text-on-surface">
                          {ord.itemsCount} รายการ
                        </td>
                        <td className="p-4 text-right font-code-md font-bold text-on-surface">
                          ฿{formattedTotal}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-code-sm text-code-sm font-semibold border ${ord.badgeClass || 'bg-success/10 text-success border-success/30'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {ord.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => handlePrintInvoice(ord.id)}
                            className="text-primary hover:underline font-label-md font-semibold inline-flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">print</span>
                            <span>ใบกำกับภาษี</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
};
