import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fetchProductsApi, setProductStatusApi, updateProductApi } from '../services/api';
import { PRODUCT_STATUS } from '../../config/business';
import type { Product } from '../types';

const money = (value: number) => value.toLocaleString('th-TH', { minimumFractionDigits: 2 });

// FR-1.3.2, FR-9: Admin เห็นสินค้าทั้งหมดรวมที่ปิดขาย แก้ราคา/สต็อก และเปิด/ปิดขาย
export const AdminProductsPage: React.FC = () => {
  const { token, addToast, showApiError } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // ค่าที่กรอก ถ้าเว้นว่างจะไม่ส่งฟิลด์นั้น
  const [drafts, setDrafts] = useState<Record<string, { price: string; stock: string }>>({});

  const loadProducts = async () => {
    if (!token) return;
    try {
      const data = await fetchProductsApi(token);
      setProducts(data.products || []);
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถโหลดรายการสินค้าได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [token]);

  const draftOf = (id: string) => drafts[id] ?? { price: '', stock: '' };

  const setDraft = (id: string, field: 'price' | 'stock', value: string) => {
    setDrafts(prev => ({ ...prev, [id]: { ...draftOf(id), [field]: value } }));
  };

  // OP-15 updateProduct (api-server ตรวจช่วงค่าเอง)
  const handleSave = async (id: string) => {
    if (!token) return;
    const draft = draftOf(id);
    const changes: { price?: number; stock?: number } = {};
    if (draft.price.trim() !== '') changes.price = Number(draft.price);
    if (draft.stock.trim() !== '') changes.stock = Number(draft.stock);

    setBusyId(id);
    try {
      await updateProductApi(token, id, changes);
      setDrafts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      addToast(`บันทึกสินค้า ${id} แล้ว`, 'success');
      await loadProducts();
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถแก้ไขสินค้าได้');
    } finally {
      setBusyId(null);
    }
  };

  // OP-16 setProductStatus
  const handleToggleStatus = async (product: Product) => {
    if (!token) return;
    const id = String(product.id);
    const next = product.status === PRODUCT_STATUS.ON_SALE ? PRODUCT_STATUS.OFF_SALE : PRODUCT_STATUS.ON_SALE;

    setBusyId(id);
    try {
      await setProductStatusApi(token, id, next);
      addToast(`เปลี่ยนสถานะ ${id} เป็น ${next} แล้ว`, 'success');
      await loadProducts();
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถเปลี่ยนสถานะสินค้าได้');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main data-testid="page-admin-products" className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
      <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col gap-space-lg">
        <div className="flex flex-col gap-space-xs pb-space-md border-b border-surface-variant">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">จัดการสินค้า</h1>
          <p className="font-body-md text-on-surface-variant">แก้ราคาและสต็อก หรือเปิด/ปิดการขาย (เว้นช่องว่างไว้ถ้าไม่ต้องการแก้ค่านั้น)</p>
        </div>

        <div className="bg-surface-container-lowest rounded-lg border border-surface-variant shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse font-body-sm text-body-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant text-on-surface-variant">
                <th className="p-3">สินค้า</th>
                <th className="p-3 text-right">ราคา</th>
                <th className="p-3 text-right">สต็อกพร้อมขาย</th>
                <th className="p-3 text-center">สถานะ</th>
                <th className="p-3">แก้ไข</th>
                <th className="p-3 text-right">การขาย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-on-surface-variant">กำลังโหลดสินค้า...</td>
                </tr>
              ) : (
                products.map(product => {
                  const id = String(product.id);
                  const price = Number(product.price || 0);
                  const stock = product.available_stock ?? 0;
                  const onSale = product.status === PRODUCT_STATUS.ON_SALE;
                  const draft = draftOf(id);
                  const busy = busyId === id;

                  return (
                    <tr key={id} data-testid={`admin-product-row-${id}`}>
                      <td className="p-3">
                        <span className="font-code-sm text-on-surface-variant mr-2">{id}</span>
                        <span className="font-semibold text-on-surface">{product.name}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span data-testid="admin-product-price" data-value={price}>฿{money(price)}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span data-testid="admin-product-stock" data-value={stock}>{stock}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          data-testid="admin-product-status"
                          data-status={product.status}
                          className={`px-2 py-0.5 rounded font-code-sm font-semibold ${onSale ? 'bg-success/10 text-success' : 'bg-surface-container text-on-surface-variant'}`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            aria-label={`ราคาใหม่ของ ${id}`}
                            data-testid="admin-product-price-input"
                            placeholder="ราคา"
                            value={draft.price}
                            onChange={e => setDraft(id, 'price', e.target.value)}
                            className="w-24 px-2 py-1.5 bg-surface-container-low border border-outline-variant/40 rounded-lg"
                          />
                          <input
                            type="number"
                            aria-label={`สต็อกใหม่ของ ${id}`}
                            data-testid="admin-product-stock-input"
                            placeholder="สต็อก"
                            value={draft.stock}
                            onChange={e => setDraft(id, 'stock', e.target.value)}
                            className="w-20 px-2 py-1.5 bg-surface-container-low border border-outline-variant/40 rounded-lg"
                          />
                          <button
                            type="button"
                            data-testid="admin-product-save"
                            disabled={busy}
                            onClick={() => handleSave(id)}
                            className="px-3 py-1.5 bg-primary text-on-primary font-label-md font-semibold rounded-lg disabled:opacity-60"
                          >
                            บันทึก
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          data-testid="admin-product-toggle-status"
                          disabled={busy}
                          onClick={() => handleToggleStatus(product)}
                          className="px-3 py-1.5 border border-outline-variant/60 font-label-md font-semibold rounded-lg disabled:opacity-60"
                        >
                          {onSale ? 'ปิดขาย' : 'เปิดขาย'}
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
    </main>
  );
};
