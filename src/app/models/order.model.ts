export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

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
  contactMethod: 'phone' | 'whatsapp' | 'email';
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
}

export interface Order extends CreateOrderRequest {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  userId?: string;
}
