export interface CartItem {
  productId: string;
  variantKey?: string;
  variantLabel?: string;
  qty: number;
}

export interface CartLine extends CartItem {
  key: string;
}

export function cartLineKey(productId: string, variantKey?: string): string {
  return variantKey ? `${productId}::${variantKey}` : productId;
}
