import { getDatabase, DatabaseConnection } from '../db/sqlite';
import { Cart, CartItem } from '../models/cart';
import { handleDatabaseError, NotFoundError, ValidationError } from '../utils/errors';
import { mapDatabaseRows, DatabaseRow } from '../utils/sql';

export class CartsRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  async create(cartId: string): Promise<void> {
    try {
      await this.db.run('INSERT INTO carts (cart_id) VALUES (?)', [cartId]);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  async findById(cartId: string): Promise<Cart | null> {
    try {
      const cart = await this.db.get<{ cart_id: string }>('SELECT cart_id FROM carts WHERE cart_id = ?', [
        cartId,
      ]);
      if (!cart) {
        return null;
      }

      const rows = await this.db.all<DatabaseRow>(
        `SELECT p.product_id, p.name, p.description, p.price, p.img_name, p.sku, p.unit, p.discount,
                ROUND(p.price * (1.0 - COALESCE(p.discount, 0)), 2) AS effective_price,
                ci.quantity,
                ROUND(ROUND(p.price * (1.0 - COALESCE(p.discount, 0)), 2) * ci.quantity, 2) AS line_total
         FROM cart_items ci
         JOIN products p ON p.product_id = ci.product_id
         WHERE ci.cart_id = ?
         ORDER BY p.name COLLATE NOCASE`,
        [cartId],
      );
      const items = mapDatabaseRows<CartItem>(rows);
      return {
        cartId: cart.cart_id,
        items,
        total: Math.round((items.reduce((total, item) => total + item.lineTotal, 0) + Number.EPSILON) * 100) / 100,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  async addItem(cartId: string, productId: number, quantity: number): Promise<Cart> {
    this.validateQuantity(quantity);

    try {
      await this.requireCart(cartId);
      const product = await this.db.get<{ product_id: number }>(
        'SELECT product_id FROM products WHERE product_id = ?',
        [productId],
      );
      if (!product) {
        throw new NotFoundError('Product', productId);
      }

      await this.db.run(
        `INSERT INTO cart_items (cart_id, product_id, quantity)
         VALUES (?, ?, ?)
         ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = cart_items.quantity + excluded.quantity`,
        [cartId, productId, quantity],
      );
      const updatedCart = await this.findById(cartId);
      if (!updatedCart) {
        throw new NotFoundError('Cart', cartId);
      }
      return updatedCart;
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  async updateItem(cartId: string, productId: number, quantity: number): Promise<Cart> {
    this.validateQuantity(quantity);

    try {
      await this.requireCart(cartId);
      const result = await this.db.run(
        'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
        [quantity, cartId, productId],
      );
      if (result.changes === 0) {
        throw new NotFoundError('Cart item', productId);
      }
      const updatedCart = await this.findById(cartId);
      if (!updatedCart) {
        throw new NotFoundError('Cart', cartId);
      }
      return updatedCart;
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  async removeItem(cartId: string, productId: number): Promise<Cart> {
    try {
      await this.requireCart(cartId);
      const result = await this.db.run(
        'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cartId, productId],
      );
      if (result.changes === 0) {
        throw new NotFoundError('Cart item', productId);
      }
      const updatedCart = await this.findById(cartId);
      if (!updatedCart) {
        throw new NotFoundError('Cart', cartId);
      }
      return updatedCart;
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  private async requireCart(cartId: string): Promise<void> {
    const cart = await this.db.get<{ cart_id: string }>('SELECT cart_id FROM carts WHERE cart_id = ?', [
      cartId,
    ]);
    if (!cart) {
      throw new NotFoundError('Cart', cartId);
    }
  }

  private validateQuantity(quantity: number): void {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new ValidationError('Cart quantity must be a positive integer');
    }
  }
}

export async function createCartsRepository(isTest: boolean = false): Promise<CartsRepository> {
  const db = await getDatabase(isTest);
  return new CartsRepository(db);
}

let cartsRepo: CartsRepository | null = null;

export async function getCartsRepository(isTest: boolean = false): Promise<CartsRepository> {
  const isTestEnv = isTest || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  if (isTestEnv) {
    return createCartsRepository(true);
  }
  if (!cartsRepo) {
    cartsRepo = await createCartsRepository(false);
  }
  return cartsRepo;
}
