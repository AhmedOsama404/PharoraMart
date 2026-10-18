import type { Order, OrderStatus } from '../../models/order.model';

/** Single typed boundary for order DTOs (API_CONTRACT.md §5). */

export interface BackendOrder {
  id: string;
  orderNumber: string;
  customer: {
    fullName: string;
    phone: string;
    email?: string | null;
    city: string;
    hotelId: string;
    hotelName: string;
    room?: string | null;
    notes?: string | null;
    contactMethod: string;
  };
  items: {
    productId: string;
    productName: string;
    image: string;
    unitPrice: number;
    qty: number;
    variantLabel?: string | null;
  }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  userId?: string | null;
  discount?: number | null;
  couponCode?: string | null;
  exchangeRateDate?: string | null;
  exchangeRateSource?: string | null;
}

export interface BackendPagedOrder {
  items: BackendOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export function toOrder(o: BackendOrder): Order {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customer: {
      fullName: o.customer.fullName,
      phone: o.customer.phone,
      email: o.customer.email ?? undefined,
      city: o.customer.city,
      hotelId: o.customer.hotelId,
      hotelName: o.customer.hotelName,
      room: o.customer.room ?? undefined,
      notes: o.customer.notes ?? undefined,
      contactMethod: o.customer.contactMethod as 'phone' | 'whatsapp' | 'email',
    },
    items: o.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      image: i.image,
      unitPrice: i.unitPrice,
      qty: i.qty,
      variantLabel: i.variantLabel ?? undefined,
    })),
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    currency: o.currency,
    // Contract: cash on delivery is the only supported method; the backend
    // echoes it verbatim and recomputes nothing about payment itself.
    paymentMethod: 'cash_on_delivery',
    status: o.status as OrderStatus,
    createdAt: o.createdAt,
    userId: o.userId ?? undefined,
    discount: o.discount ?? 0,
    couponCode: o.couponCode ?? undefined,
    exchangeRateDate: o.exchangeRateDate ?? undefined,
    exchangeRateSource: o.exchangeRateSource ?? undefined,
  };
}
