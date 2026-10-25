import axios from 'axios';
import { QueryClient, QueryClientProvider } from 'react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Products from './Products';
import { addItemToCart } from '../../../api/cart';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../../api/cart', () => ({
  addItemToCart: vi.fn(),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ darkMode: false }),
}));

const product = {
  productId: 1,
  name: 'Smart Feeder',
  description: 'Automatic feeder',
  price: 10,
  imgName: 'feeder.png',
  sku: 'FEEDER-1',
  unit: 'each',
  supplierId: 1,
};

describe('Product cart actions', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockResolvedValue({ data: [product] } as never);
    vi.mocked(addItemToCart).mockResolvedValue({
      cartId: '78f41911-538f-4834-8993-6ecce103d6ba',
      items: [],
      total: 0,
    });
  });

  it('adds the selected product quantity to the cart', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Products />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Increase quantity of Smart Feeder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 Smart Feeder to cart' }));

    await waitFor(() => expect(addItemToCart).toHaveBeenCalledWith(1, 1));
    expect(await screen.findByText('Product added to your cart.')).not.toBeNull();
  });
});
