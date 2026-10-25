import axios from 'axios';
import { api } from './config';

const CART_ID_STORAGE_KEY = 'octocat-cart-id';

export interface CartItem {
  productId: number;
  name: string;
  description: string | null;
  price: number;
  effectivePrice: number;
  imgName: string | null;
  sku: string;
  unit: string;
  discount: number | null;
  quantity: number;
  lineTotal: number;
}

export interface Cart {
  cartId: string;
  items: CartItem[];
  total: number;
}

export function getStoredCartId(): string | null {
  return localStorage.getItem(CART_ID_STORAGE_KEY);
}

async function getOrCreateCartId(): Promise<string> {
  const existingCartId = getStoredCartId();
  if (existingCartId) {
    return existingCartId;
  }

  const { data } = await axios.post<{ cartId: string }>(`${api.baseURL}${api.endpoints.carts}`);
  localStorage.setItem(CART_ID_STORAGE_KEY, data.cartId);
  return data.cartId;
}

export async function fetchCart(cartId: string): Promise<Cart> {
  const { data } = await axios.get<Cart>(`${api.baseURL}${api.endpoints.carts}/${cartId}`);
  return data;
}

export async function addItemToCart(productId: number, quantity: number): Promise<Cart> {
  const cartId = await getOrCreateCartId();
  const { data } = await axios.post<Cart>(`${api.baseURL}${api.endpoints.carts}/${cartId}/items`, {
    productId,
    quantity,
  });
  return data;
}

export async function updateCartItem(
  cartId: string,
  productId: number,
  quantity: number,
): Promise<Cart> {
  const { data } = await axios.put<Cart>(
    `${api.baseURL}${api.endpoints.carts}/${cartId}/items/${productId}`,
    { quantity },
  );
  return data;
}

export async function removeCartItem(cartId: string, productId: number): Promise<Cart> {
  const { data } = await axios.delete<Cart>(
    `${api.baseURL}${api.endpoints.carts}/${cartId}/items/${productId}`,
  );
  return data;
}
