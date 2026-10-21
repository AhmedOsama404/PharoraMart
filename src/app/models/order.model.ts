export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'outfordelivery' | 'delivered' | 'cancelled';

export interface CheckoutFormValue {
  fullName: string;
  phone: string;
  email?: string;
  /** Delivery city/region, e.g. 'Marsa Alam' (data-driven hotel directory). */
  city: string;
  /** Stable hotel id (never the display name). */
  hotelId: string;
  /** Hotel display-name snapshot for orders/emails. */
  hotelName: string;
  room?: string;
  notes?: string;
  /** Determined by environment.contactMode ('whatsapp' | 'email' | 'both'). */
  contactMethod?: 'phone' | 'whatsapp' | 'email' | 'both';
}

export interface OrderItemInput {
  productId: string;
  productName: string;
  image: string;
  unitPrice: number;
  qty: number;
  variantLabel?: string;
}

export interface CreateOrderRequest {
  customer: CheckoutFormValue;
  items: OrderItemInput[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  paymentMethod: 'cash_on_delivery';
  /** Optional coupon code; the backend validates and prices it. */
  couponCode?: string;
  exchangeRateDate?: string;
  /** The language the customer wants to be contacted in (frozen at order time). */
  language?: string;
  /** The customer opted in to WhatsApp updates at checkout. */
  whatsappOptIn?: boolean;
}

export interface Order extends CreateOrderRequest {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  userId?: string;
  /** Server-computed discount (0 when no coupon). */
  discount?: number;
  exchangeRateDate?: string;
  exchangeRateSource?: string;
}
