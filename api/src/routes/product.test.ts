import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import productRouter from './product';
import { runMigrations } from '../db/migrate';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { errorHandler } from '../utils/errors';

let app: express.Express;

describe('Product discount validation', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);

    const db = await getDatabase();
    await db.run('INSERT INTO suppliers (supplier_id, name) VALUES (?, ?)', [1, 'Test Supplier']);
    await db.run(
      `INSERT INTO products (product_id, supplier_id, name, description, price, sku, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [1, 1, 'Smart Feeder', 'Automatic feeder', 10, 'FEEDER-1', 'each'],
    );

    app = express();
    app.use(express.json());
    app.use('/products', productRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it.each([-0.01, 1.01, Number.NaN])('rejects invalid discount %s when creating a product', async (discount) => {
    const response = await request(app).post('/products').send({
      supplierId: 1,
      name: 'Discounted Feeder',
      description: 'Invalid discount test',
      price: 10,
      sku: 'FEEDER-INVALID',
      unit: 'each',
      discount,
    });

    expect(response.status).toBe(400);
  });

  it.each([-0.01, 1.01])('rejects invalid discount %s when updating a product', async (discount) => {
    const response = await request(app).put('/products/1').send({ discount });

    expect(response.status).toBe(400);
  });

  it('accepts valid boundary discount values', async () => {
    const zeroDiscount = await request(app).put('/products/1').send({ discount: 0 });
    expect(zeroDiscount.status).toBe(200);
    expect(zeroDiscount.body.discount).toBe(0);

    const fullDiscount = await request(app).put('/products/1').send({ discount: 1 });
    expect(fullDiscount.status).toBe(200);
    expect(fullDiscount.body.discount).toBe(1);
  });

  it('searches by a parameterized partial product name', async () => {
    const match = await request(app).get('/products/name/Feeder');
    expect(match.status).toBe(200);
    expect(match.body).toHaveLength(1);
    expect(match.body[0].name).toBe('Smart Feeder');

    const injectionShapedSearch = await request(app).get('/products/name/%27%20OR%201%3D1%20--');
    expect(injectionShapedSearch.status).toBe(200);
    expect(injectionShapedSearch.body).toEqual([]);
  });
});
