import React from 'react';
import { useApp } from '../context/AppContext';

export const CartPage: React.FC = () => {
  const {
    cart,
    cartId,
    cartCount,
    cartSubtotal,
    cartVat,
    cartTotal,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    setCurrentView
  } = useApp();

  return (
    <main className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
      <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col gap-space-lg">
        
        {/* Header Metadata */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-sm pb-space-md border-b border-surface-variant">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs text-on-surface-variant font-code-sm text-code-sm tracking-wider uppercase">
              <span>รอบตะกร้าสินค้า #{cartId}</span>
              <span>•</span>
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

        {cart.length === 0 ? (
          <div className="w-full bg-surface-container-lowest rounded-lg p-16 border border-surface-variant text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl">shopping_cart</span>
            </div>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">ตะกร้าสินค้าของคุณยังว่างอยู่</h2>
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
                {cart.map(item => {
                  const itemSubtotal = (item.price * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 });
                  const unitPrice = item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 });

                  return (
                    <div key={item.id} className="p-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
                      <div className="flex items-center gap-space-md flex-1">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-16 h-16 rounded-lg object-cover bg-surface-container border border-surface-variant shrink-0"
                          onError={(e: any) => {
                            e.target.src = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=400&q=80';
                          }}
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="font-code-sm text-code-sm text-on-surface-variant">{item.category || 'สินค้าองค์กร'}</span>
                          <h4 className="font-headline-sm text-label-md text-on-surface font-semibold line-clamp-1">{item.name}</h4>
                          <span className="font-code-sm text-code-sm text-secondary">ราคาต่อหน่วย: ฿{unitPrice}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-space-md w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center border border-outline-variant/50 rounded-lg overflow-hidden bg-surface-container-low">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                            className="p-2 hover:bg-surface-variant text-on-surface flex items-center justify-center transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">remove</span>
                          </button>
                          <span className="px-3 font-code-md text-code-md font-bold text-on-surface">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                            className="p-2 hover:bg-surface-variant text-on-surface flex items-center justify-center transition-colors"
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
                          onClick={() => removeFromCart(item.id)}
                          className="p-2 text-secondary hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
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
                  onClick={clearCart}
                  className="text-error hover:underline text-body-sm flex items-center gap-1 font-medium"
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

              <div className="flex flex-col gap-3 font-body-sm text-body-sm">
                <div className="flex justify-between text-on-surface-variant">
                  <span>ราคาสินค้ารวม (Subtotal)</span>
                  <span className="font-code-sm text-on-surface font-semibold">
                    ฿{cartSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                  <span className="font-code-sm text-on-surface font-semibold">
                    ฿{cartVat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>ค่าบริการจัดส่ง (Shipping)</span>
                  <span className="font-code-sm text-success font-semibold">ฟรี (Enterprise Direct)</span>
                </div>

                <div className="pt-3 border-t border-surface-variant flex justify-between items-baseline">
                  <span className="font-label-md text-label-md font-bold text-on-surface">ยอดรวมทั้งสิ้น</span>
                  <span className="font-code-md text-headline-md font-bold text-primary">
                    ฿{cartTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
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
