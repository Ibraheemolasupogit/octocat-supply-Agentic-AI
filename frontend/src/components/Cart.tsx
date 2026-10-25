import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { Cart as CartData, fetchCart, getStoredCartId, removeCartItem, updateCartItem } from '../api/cart';
import { useTheme } from '../context/ThemeContext';

export default function Cart() {
  const [cartId] = useState(getStoredCartId);
  const { darkMode } = useTheme();
  const queryClient = useQueryClient();
  const { data: cart, isLoading, error } = useQuery(
    ['cart', cartId],
    () => fetchCart(cartId as string),
    { enabled: Boolean(cartId) },
  );

  const saveCart = (updatedCart: CartData) => {
    queryClient.setQueryData(['cart', updatedCart.cartId], updatedCart);
  };

  const updateMutation = useMutation(
    ({ productId, quantity }: { productId: number; quantity: number }) =>
      updateCartItem(cartId as string, productId, quantity),
    { onSuccess: saveCart },
  );
  const removeMutation = useMutation((productId: number) => removeCartItem(cartId as string, productId), {
    onSuccess: saveCart,
  });
  const mutationError = updateMutation.error || removeMutation.error;
  const textColor = darkMode ? 'text-light' : 'text-gray-800';
  const cardColor = darkMode ? 'bg-gray-800' : 'bg-white';

  return (
    <section className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 pb-16 px-4`}>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className={`text-3xl font-bold ${textColor}`}>My Cart</h1>

        {isLoading && <p role="status" className={textColor}>Loading your cart...</p>}
        {error != null && (
          <p role="alert" className="text-red-500">
            Unable to load your cart. Please try again.
          </p>
        )}
        {mutationError != null && (
          <p role="alert" className="text-red-500">
            Unable to update your cart. Please try again.
          </p>
        )}
        {!cartId && <EmptyCart textColor={textColor} />}
        {cart && cart.items.length === 0 && <EmptyCart textColor={textColor} />}

        {cart && cart.items.length > 0 && (
          <>
            <ul className="space-y-4">
              {cart.items.map((item) => (
                <li
                  key={item.productId}
                  className={`${cardColor} rounded-lg shadow p-4 flex flex-col sm:flex-row sm:items-center gap-4`}
                >
                  <img
                    src={`/${item.imgName ?? ''}`}
                    alt={item.name}
                    className="w-24 h-24 object-contain"
                  />
                  <div className="flex-grow">
                    <h2 className={`font-semibold text-lg ${textColor}`}>{item.name}</h2>
                    <p className="text-gray-500">
                      {item.discount != null && item.discount > 0 && (
                        <span className="line-through mr-2">${item.price.toFixed(2)}</span>
                      )}
                      <span className={item.discount != null && item.discount > 0 ? 'text-primary font-semibold' : ''}>
                        ${item.effectivePrice.toFixed(2)} each
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={`Decrease quantity of ${item.name}`}
                      disabled={item.quantity <= 1 || updateMutation.isLoading}
                      onClick={() =>
                        updateMutation.mutate({ productId: item.productId, quantity: item.quantity - 1 })
                      }
                      className="w-8 h-8 rounded bg-gray-200 disabled:opacity-50"
                    >
                      -
                    </button>
                    <span aria-label={`Quantity of ${item.name}`} className={textColor}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${item.name}`}
                      disabled={updateMutation.isLoading}
                      onClick={() =>
                        updateMutation.mutate({ productId: item.productId, quantity: item.quantity + 1 })
                      }
                      className="w-8 h-8 rounded bg-gray-200 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                  <p className={`font-semibold min-w-20 text-right ${textColor}`}>
                    ${item.lineTotal.toFixed(2)}
                  </p>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name} from cart`}
                    disabled={removeMutation.isLoading}
                    onClick={() => removeMutation.mutate(item.productId)}
                    className="text-red-600 hover:text-red-800 underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className={`${cardColor} rounded-lg shadow p-4 flex justify-between items-center`}>
              <span className={`text-xl font-semibold ${textColor}`}>Total</span>
              <span className={`text-xl font-bold ${textColor}`}>${cart.total.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function EmptyCart({ textColor }: { textColor: string }) {
  return (
    <div className="text-center py-12">
      <p className={`${textColor} text-lg`}>Your cart is empty.</p>
      <Link to="/products" className="inline-block mt-4 text-primary hover:underline">
        Browse products
      </Link>
    </div>
  );
}
