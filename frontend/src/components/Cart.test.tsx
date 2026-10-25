import { QueryClient, QueryClientProvider } from 'react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Cart from './Cart';
import {
  Cart as CartData,
  fetchCart,
  getStoredCartId,
  removeCartItem,
  updateCartItem,
} from '../api/cart';

vi.mock('../api/cart', () => ({
  fetchCart: vi.fn(),
  getStoredCartId: vi.fn(),
  removeCartItem: vi.fn(),
  updateCartItem: vi.fn(),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ darkMode: false }),
}));

const initialCart: CartData = {
  cartId: '78f41911-538f-4834-8993-6ecce103d6ba',
  items: [
    {
      productId: 1,
      name: 'Smart Feeder',
      description: 'Automatic feeder',
      price: 10,
      effectivePrice: 10,
      imgName: 'feeder.png',
      sku: 'FEEDER-1',
      unit: 'each',
      discount: null,
      quantity: 2,
      lineTotal: 20,
    },
  ],
  total: 20,
};

function renderCart() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Cart />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Cart page', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStoredCartId).mockReturnValue(initialCart.cartId);
    vi.mocked(fetchCart).mockResolvedValue(initialCart);
  });

  it('updates an item quantity and reflects the updated cart total', async () => {
    vi.mocked(updateCartItem).mockResolvedValue({
      ...initialCart,
      items: [{ ...initialCart.items[0], quantity: 3, lineTotal: 30 }],
      total: 30,
    });
    renderCart();

    fireEvent.click(await screen.findByRole('button', { name: 'Increase quantity of Smart Feeder' }));

    await waitFor(() => expect(updateCartItem).toHaveBeenCalledWith(initialCart.cartId, 1, 3));
    expect(screen.getByText('Total').parentElement?.textContent).toContain('$30.00');
    expect(screen.getByLabelText('Quantity of Smart Feeder').textContent).toBe('3');
  });

  it('removes an item and displays the empty-cart state', async () => {
    vi.mocked(removeCartItem).mockResolvedValue({ ...initialCart, items: [], total: 0 });
    renderCart();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Smart Feeder from cart' }));

    await waitFor(() => expect(removeCartItem).toHaveBeenCalledWith(initialCart.cartId, 1));
    expect(await screen.findByText('Your cart is empty.')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Browse products' }).getAttribute('href')).toBe('/products');
  });

  it('shows the regular and discounted unit prices for a sale item', async () => {
    vi.mocked(fetchCart).mockResolvedValue({
      ...initialCart,
      items: [
        {
          ...initialCart.items[0],
          discount: 0.25,
          effectivePrice: 7.5,
          lineTotal: 15,
        },
      ],
      total: 15,
    });
    renderCart();

    expect(await screen.findByText('$10.00')).not.toBeNull();
    expect(screen.getByText('$7.50 each')).not.toBeNull();
    expect(screen.getByText('Total').parentElement?.textContent).toContain('$15.00');
  });
});
