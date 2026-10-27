import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fetchProductsApi, addToCartApi } from '../services/api';
import type { Product } from '../types';

export const ProductsPage: React.FC = () => {
  const { token, cartId, addToCart, addToast } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const loadProducts = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const data = await fetchProductsApi(token);
      setProducts(data.products || []);
    } catch (err: any) {
      console.error('Fetch products error:', err);
      setErrorMsg(err.message || 'ไม่สามารถดึงข้อมูลสินค้าจาก API GET /list ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [token]);

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter((c): c is string => Boolean(c))))];

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.description && p.description.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  const handleAddToCart = async (product: Product) => {
    if (!token) return;
    setAddingId(product.id);

    try {
      // Call POST /cart/items API
      await addToCartApi(token, cartId, product.id, 1);
      
      // Update local React state
      addToCart(product, 1);

      addToast(`เพิ่ม "${product.name || 'สินค้า'}" ลงตะกร้าเรียบร้อยแล้ว!`, 'success');
    } catch (err: any) {
      console.error('Add to cart error:', err);
      addToast(err.message || 'ไม่สามารถเพิ่มสินค้าลงตะกร้าได้', 'error', err.code);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <main className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
      <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col gap-space-lg">

        {/* Controls: Search & Category Filter */}
        <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-surface-variant flex flex-col gap-space-md">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-space-sm items-center">
            
            <div className="md:col-span-6 relative">
              <div className="absolute inset-y-0 left-0 pl-space-sm flex items-center pointer-events-none text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อสินค้า, หมวดหมู่ หรือรายละเอียด..."
                className="w-full pl-9 pr-space-md py-2.5 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm placeholder:text-on-surface-variant/60"
              />
            </div>

            <div className="md:col-span-4">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full px-space-sm py-2.5 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'หมวดหมู่ทั้งหมด' : cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <span className="font-code-sm text-code-sm text-on-surface-variant px-3 py-1 bg-surface-container rounded-lg">
                {loading ? 'กำลังโหลด...' : `พบ ${filteredProducts.length} รายการ`}
              </span>
            </div>

          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
            <p className="font-body-md text-on-surface-variant font-medium">กำลังโหลดรายการสินค้าจาก API (GET /list)...</p>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-6 bg-error-container text-on-error-container rounded-lg border border-error/20 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-2xl">error</span>
              <h3 className="font-headline-sm font-bold">เกิดข้อผิดพลาดในการโหลดสินค้า</h3>
            </div>
            <p className="font-body-sm">{errorMsg}</p>
            <button
              onClick={loadProducts}
              className="self-start mt-2 px-4 py-2 bg-error text-on-error font-label-md rounded-lg hover:bg-error/90 transition-colors"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {/* Product Grid */}
        {!loading && !errorMsg && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-lg">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-on-surface-variant flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-4xl">inventory_2</span>
                <p className="font-body-lg">ไม่พบสินค้าตรงกับเงื่อนไขการค้นหา</p>
              </div>
            ) : (
              filteredProducts.map(product => {
                const name = product.name || product.title || `สินค้า #${product.id}`;
                const price = Number(product.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
                const imgUrl = product.image_url || product.image || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=400&q=80';
                const category = product.category || 'ทั่วไป';
                const description = product.description || 'สินค้าคุณภาพสำหรับองค์กร พร้อมการรับประกันมาตรฐาน';
                const isAdding = String(addingId) === String(product.id);

                return (
                  <div
                    key={product.id}
                    className="bg-surface-container-lowest rounded-lg border border-surface-variant shadow-sm hover:shadow-md hover:border-primary/50 transition-all flex flex-col justify-between overflow-hidden"
                  >
                    <div>
                      <div className="w-full h-48 bg-surface-container-low relative overflow-hidden">
                        <img
                          src={imgUrl}
                          alt={name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          onError={(e: any) => {
                            e.target.src = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=400&q=80';
                          }}
                        />
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded bg-surface-container-lowest/90 text-on-surface font-code-sm text-code-sm border border-outline-variant/30 shadow-sm">
                          {category}
                        </span>
                      </div>

                      <div className="p-space-md flex flex-col gap-2">
                        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold line-clamp-1" title={name}>
                          {name}
                        </h3>
                        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 min-h-[2.75rem]">
                          {description}
                        </p>
                      </div>
                    </div>

                    <div className="p-space-md pt-0 flex flex-col gap-3">
                      <div className="flex items-baseline justify-between pt-2 border-t border-surface-variant">
                        <span className="font-code-sm text-code-sm text-on-surface-variant">ราคา</span>
                        <span className="font-code-md text-headline-sm text-primary font-bold">฿{price}</span>
                      </div>

                      <button
                        type="button"
                        disabled={isAdding}
                        onClick={() => handleAddToCart(product)}
                        className="w-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-2.5 rounded-lg transition-colors font-semibold shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {isAdding ? (
                          <>
                            <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                            <span>กำลังบันทึก...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
                            <span>เพิ่มลงตะกร้า</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </main>
  );
};
