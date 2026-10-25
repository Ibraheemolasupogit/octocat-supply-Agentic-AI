import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import cartRouter from './cart';
import { runMigrations } from '../db/migrate';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { errorHandler } from '../utils/errors';

const cartId = '78f41911-538f-4834-8993-6ecce103d6ba';
const missingCartId = 'ae3215bf-0f7b-4eac-ae9c-95f716c70fe1';
let app: express.Express;

describe('Cart API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);

    const db = await getDatabase();
    await db.run('INSERT INTO suppliers (supplier_id, name) VALUES (?, ?)', [1, 'Test Supplier']);
    await db.run(
      `INSERT INTO products (product_id, supplier_id, name, description, price, sku, unit, img_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 1, 'Smart Feeder', 'Automatic feeder', 10, 'FEEDER-1', 'each', 'feeder.png'],
    );
    await db.run(
      `INSERT INTO products (product_id, supplier_id, name, description, price, sku, unit, img_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [2, 1, 'Smart Bowl', 'Connected bowl', 0.2, 'BOWL-1', 'each', 'bowl.png'],
    );
    await db.run('INSERT INTO carts (cart_id) VALUES (?)', [cartId]);

    app = express();
    app.use(express.json());
    app.use('/carts', cartRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('creates a cart and adds quantities, merging repeated product additions', async () => {
    const created = await request(app).post('/carts');
    expect(created.status).toBe(201);
    expect(created.body.cartId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const firstAdd = await request(app)
      .post(`/carts/${created.body.cartId}/items`)
      .send({ productId: 1, quantity: 2 });
    const secondAdd = await request(app)
      .post(`/carts/${created.body.cartId}/items`)
      .send({ productId: 1, quantity: 1 });

    expect(firstAdd.status).toBe(200);
    expect(secondAdd.body).toMatchObject({
      cartId: created.body.cartId,
      items: [
        {
          productId: 1,
          name: 'Smart Feeder',
          price: 10,
          effectivePrice: 10,
          quantity: 3,
          lineTotal: 30,
        },
      ],
      total: 30,
    });

    const persistedCart = await request(app).get(`/carts/${created.body.cartId}`);
    expect(persistedCart.status).toBe(200);
    expect(persistedCart.body.items[0]).toMatchObject({ quantity: 3, lineTotal: 30 });
  });

  it('updates and removes cart items while returning current totals', async () => {
    await request(app).post(`/carts/${cartId}/items`).send({ productId: 1, quantity: 2 });

    const updated = await request(app)
      .put(`/carts/${cartId}/items/1`)
      .send({ quantity: 4 });
    expect(updated.status).toBe(200);
    expect(updated.body.items[0]).toMatchObject({ quantity: 4, lineTotal: 40 });
    expect(updated.body.total).toBe(40);

    const removed = await request(app).delete(`/carts/${cartId}/items/1`);
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ items: [], total: 0 });
  });

  it('applies product discounts to effective unit price and cart totals', async () => {
    const db = await getDatabase();
    await db.run('UPDATE products SET price = ?, discount = ? WHERE product_id = ?', [10.01, 0.333, 1]);

    const response = await request(app)
      .post(`/carts/${cartId}/items`)
      .send({ productId: 1, quantity: 3 });

    expect(response.status).toBe(200);
    expect(response.body.items[0]).toMatchObject({
      price: 10.01,
      discount: 0.333,
      effectivePrice: 6.68,
      quantity: 3,
      lineTotal: 20.04,
    });
    expect(response.body.total).toBe(20.04);
  });

  it('rounds cart totals to currency precision across multiple lines', async () => {
    const db = await getDatabase();
    await db.run('UPDATE products SET price = ? WHERE product_id = ?', [0.1, 1]);

    await request(app).post(`/carts/${cartId}/items`).send({ productId: 1, quantity: 1 });
    const response = await request(app)
      .post(`/carts/${cartId}/items`)
      .send({ productId: 2, quantity: 1 });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0.3);
  });

  it('rejects invalid quantities and missing products', async () => {
    const invalidQuantity = await request(app)
      .post(`/carts/${cartId}/items`)
      .send({ productId: 1, quantity: 0 });
    expect(invalidQuantity.status).toBe(400);

    const missingProduct = await request(app)
      .post(`/carts/${cartId}/items`)
      .send({ productId: 999, quantity: 1 });
    expect(missingProduct.status).toBe(404);

    const invalidProductId = await request(app)
      .post(`/carts/${cartId}/items`)
      .send({ productId: '1', quantity: 1 });
    expect(invalidProductId.status).toBe(400);

    const invalidCartId = await request(app)
      .post('/carts/not-a-uuid/items')
      .send({ productId: 1, quantity: 1 });
    expect(invalidCartId.status).toBe(400);

    const invalidUpdatedQuantity = await request(app)
      .put(`/carts/${cartId}/items/1`)
      .send({ quantity: -1 });
    expect(invalidUpdatedQuantity.status).toBe(400);
  });

  it('returns 404 for an unknown cart or cart item', async () => {
    const missingCart = await request(app).get(`/carts/${missingCartId}`);
    expect(missingCart.status).toBe(404);

    const missingItem = await request(app).delete(`/carts/${cartId}/items/999`);
    expect(missingItem.status).toBe(404);
  });
});
