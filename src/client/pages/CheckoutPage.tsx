import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const CheckoutPage: React.FC = () => {
  const { cart, cartCount, cartSubtotal, cartVat, cartTotal, addOrder, clearCart, setCurrentView, addToast } = useApp();
  const [loading, setLoading] = useState(false);

  if (cart.length === 0) {
    setCurrentView('cart');
    return null;
  }

  const handleConfirmPay = () => {
    setLoading(true);

    setTimeout(() => {
      const txnId = `TXN-${Math.floor(10000000 + Math.random() * 90000000)}-X9`;
      addOrder(txnId);
      clearCart();
      addToast('การชำระเงินและยืนยันคำสั่งซื้อสำเร็จ!', 'success');
      setCurrentView('order-confirmation');
    }, 1200);
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
            onClick={() => setCurrentView('cart')}
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
              <h4 className="font-headline-sm text-headline-sm font-bold">ระบบพร้อมดำเนินการชำระเงิน</h4>
              <span className="font-code-sm text-code-sm px-2 py-0.5 rounded bg-success/10 text-success font-bold">READY</span>
            </div>
            <p className="font-body-sm text-on-surface-variant mt-1">
              ข้อมูลธุรกรรมจะถูกส่งและบันทึกในระบบบันทึกคำสั่งซื้อขององค์กรโดยอัตโนมัติ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <div className="lg:col-span-7 flex flex-col gap-space-lg">
            
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
              สรุปคำสั่งซื้อ ({cartCount} รายการ)
            </h3>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-2 pr-1">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-surface-variant/40 text-body-sm">
                  <div className="flex items-center gap-2 overflow-hidden pr-2">
                    <span className="font-code-sm text-primary font-bold">x{item.quantity}</span>
                    <span className="truncate font-medium text-on-surface">{item.name}</span>
                  </div>
                  <span className="font-code-sm font-semibold shrink-0 text-on-surface">
                    ฿{(item.price * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-surface-variant font-body-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>ราคาสินค้ารวม</span>
                <span className="font-code-sm font-semibold text-on-surface">
                  ฿{cartSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                <span className="font-code-sm font-semibold text-on-surface">
                  ฿{cartVat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>ค่าจัดส่ง</span>
                <span className="font-code-sm text-success font-semibold">ฟรี</span>
              </div>

              <div className="pt-3 border-t border-surface-variant flex justify-between items-baseline">
                <span className="font-label-md text-headline-sm font-bold text-on-surface">ยอดสุทธิที่ต้องชำระ</span>
                <span className="font-code-md text-headline-md font-bold text-primary">
                  ฿{cartTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleConfirmPay}
              className="w-full mt-2 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3.5 rounded-lg font-semibold transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-xl">check_circle</span>
              <span>{loading ? 'กำลังประมวลผลธุรกรรม...' : 'ยืนยันสั่งซื้อและชำระเงิน'}</span>
              {loading && <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>}
            </button>
          </div>

        </div>

      </div>
    </main>
  );
};
