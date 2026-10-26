export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'outfordelivery' | 'delivered' | 'cancelled';

/**
 * How the customer wants to be contacted about an order.
 *
 * The API accepts exactly two values (`OrderValidators.ContactMethods`:
 * `whatsapp` and `email`); anything else is a 422. The type mirrors the
 * server's allow-list, so a value the API would reject cannot be typed here.
 */
export type ContactMethod = 'whatsapp' | 'email';

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
  contactMethod?: ContactMethod;
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
  /**
   * Proof of the consent text the customer saw: a SHA-256 hex of that exact
   * text. The server stores it with the consent record, so "what was agreed"
   * stays provable. Null when the customer did not opt in to WhatsApp.
   */
  consentTextHash?: string;
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
