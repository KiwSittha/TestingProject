import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fetchCouponsApi, setCouponStatusApi } from '../services/api';
import { COUPON_STATUS } from '../../config/business';
import type { Coupon } from '../types';

// FR-10: OP-18 listCoupons และ OP-17 setCouponStatus
export const AdminCouponsPage: React.FC = () => {
  const { token, addToast, showApiError } = useApp();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const loadCoupons = async () => {
    if (!token) return;
    try {
      const data = await fetchCouponsApi(token);
      setCoupons(data.coupons || []);
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถโหลดรายการคูปองได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, [token]);

  const handleToggle = async (coupon: Coupon) => {
    if (!token) return;
    const activate = coupon.status !== COUPON_STATUS.ACTIVE;

    setBusyCode(coupon.code);
    try {
      await setCouponStatusApi(token, coupon.code, activate);
      addToast(`เปลี่ยนสถานะคูปอง ${coupon.code} แล้ว`, 'success');
      await loadCoupons();
    } catch (err: any) {
      showApiError(err, 'ไม่สามารถเปลี่ยนสถานะคูปองได้');
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <main data-testid="page-admin-coupons" className="w-full min-h-[calc(100vh-8rem)] bg-background py-space-lg">
      <div className="max-w-[1280px] w-full mx-auto px-margin flex flex-col gap-space-lg">
        <div className="flex flex-col gap-space-xs pb-space-md border-b border-surface-variant">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">จัดการคูปอง</h1>
          <p className="font-body-md text-on-surface-variant">การเปลี่ยนสถานะมีผลกับการ checkout ครั้งถัดไปของลูกค้า</p>
        </div>

        <div className="bg-surface-container-lowest rounded-lg border border-surface-variant shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse font-body-sm text-body-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-surface-variant text-on-surface-variant">
                <th className="p-3">รหัสคูปอง</th>
                <th className="p-3 text-right">ส่วนลด (%)</th>
                <th className="p-3 text-right">ยอดขั้นต่ำ</th>
                <th className="p-3 text-center">สถานะ</th>
                <th className="p-3 text-right">การใช้งาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-on-surface-variant">กำลังโหลดคูปอง...</td>
                </tr>
              ) : (
                coupons.map(coupon => {
                  const active = coupon.status === COUPON_STATUS.ACTIVE;

                  return (
                    <tr key={coupon.code} data-testid={`admin-coupon-row-${coupon.code}`}>
                      <td className="p-3 font-code-md font-bold text-primary">{coupon.code}</td>
                      <td className="p-3 text-right">
                        <span data-testid="admin-coupon-percent" data-value={coupon.percent}>{coupon.percent}%</span>
                      </td>
                      <td className="p-3 text-right">
                        <span data-testid="admin-coupon-min-spend" data-value={coupon.min_spend}>
                          ฿{Number(coupon.min_spend).toLocaleString('th-TH')}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          data-testid="admin-coupon-status"
                          data-status={coupon.status}
                          className={`px-2 py-0.5 rounded font-code-sm font-semibold ${active ? 'bg-success/10 text-success' : 'bg-surface-container text-on-surface-variant'}`}
                        >
                          {coupon.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          data-testid="admin-coupon-toggle-status"
                          disabled={busyCode === coupon.code}
                          onClick={() => handleToggle(coupon)}
                          className="px-3 py-1.5 border border-outline-variant/60 font-label-md font-semibold rounded-lg disabled:opacity-60"
                        >
                          {active ? 'ปิดใช้' : 'เปิดใช้'}
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
