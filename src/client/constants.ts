import { ORDER_STATUS } from '../config/business';

export const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=400&q=80';

export const ZONE_LABELS: Record<string, string> = {
  inCity: 'ในเมือง',
  upcountry: 'ต่างจังหวัด',
  remote: 'พื้นที่ห่างไกล'
};

export const SPEED_LABELS: Record<string, string> = {
  standard: 'ส่งแบบปกติ',
  express: 'ส่งด่วน'
};

export const ORDER_STATUS_BADGES: Record<string, string> = {
  [ORDER_STATUS.PENDING_PAYMENT]: 'bg-warning/10 text-on-surface border-warning/50',
  [ORDER_STATUS.PAID]: 'bg-success/10 text-success border-success/30',
  [ORDER_STATUS.CANCELLED]: 'bg-surface-container text-on-surface-variant border-outline-variant/40'
};

export const formatOrderDate = (order: { created_at: string }) =>
  new Date(order.created_at).toLocaleDateString('th-TH');
