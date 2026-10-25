/**
 * @swagger
 * tags:
 *   name: Carts
 *   description: Endpoints for managing the demo storefront cart
 */
/**
 * @swagger
 * /api/carts:
 *   post:
 *     summary: Create a cart
 *     tags: [Carts]
 *     responses:
 *       201:
 *         description: Cart created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cartId:
 *                   type: string
 *                   format: uuid
 * /api/carts/{cartId}:
 *   get:
 *     summary: Get a cart and its current items
 *     tags: [Carts]
 *     parameters:
 *       - in: path
 *         name: cartId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cart with item details and total
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       404:
 *         description: Cart not found
 * /api/carts/{cartId}/items:
 *   post:
 *     summary: Add a quantity of a product to a cart
 *     tags: [Carts]
 *     parameters:
 *       - in: path
 *         name: cartId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, quantity]
 *             properties:
 *               productId:
 *                 type: integer
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Cart updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Invalid product ID or quantity
 *       404:
 *         description: Cart or product not found
 * /api/carts/{cartId}/items/{productId}:
 *   put:
 *     summary: Set the quantity of a cart item
 *     tags: [Carts]
 *     parameters:
 *       - in: path
 *         name: cartId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Cart updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Invalid quantity
 *       404:
 *         description: Cart or cart item not found
 *   delete:
 *     summary: Remove an item from a cart
 *     tags: [Carts]
 *     parameters:
 *       - in: path
 *         name: cartId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cart after removal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       404:
 *         description: Cart or cart item not found
 */

import { randomUUID } from 'crypto';
import express from 'express';
import { getCartsRepository } from '../repositories/cartsRepo';
import { NotFoundError, ValidationError } from '../utils/errors';

const router = express.Router();
const cartIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateCartId(value: string): string {
  if (!cartIdPattern.test(value)) {
    throw new ValidationError('Cart ID must be a valid UUID');
  }
  return value;
}

function validatePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return value;
}

function parseProductId(value: string): number {
  const productId = Number(value);
  if (!Number.isSafeInteger(productId) || productId < 1) {
    throw new ValidationError('Product ID must be a positive integer');
  }
  return productId;
}

router.post('/', async (_req, res, next) => {
  try {
    const cartId = randomUUID();
    const repo = await getCartsRepository();
    await repo.create(cartId);
    res.status(201).json({ cartId });
  } catch (error) {
    next(error);
  }
});

router.get('/:cartId', async (req, res, next) => {
  try {
    const cartId = validateCartId(req.params.cartId);
    const repo = await getCartsRepository();
    const cart = await repo.findById(cartId);
    if (!cart) {
      throw new NotFoundError('Cart', cartId);
    }
    res.json(cart);
  } catch (error) {
    next(error);
  }
});

router.post('/:cartId/items', async (req, res, next) => {
  try {
    const cartId = validateCartId(req.params.cartId);
    const productId = validatePositiveInteger(req.body?.productId, 'Product ID');
    const quantity = validatePositiveInteger(req.body?.quantity, 'Quantity');
    const repo = await getCartsRepository();
    res.json(await repo.addItem(cartId, productId, quantity));
  } catch (error) {
    next(error);
  }
});

router.put('/:cartId/items/:productId', async (req, res, next) => {
  try {
    const cartId = validateCartId(req.params.cartId);
    const productId = parseProductId(req.params.productId);
    const quantity = validatePositiveInteger(req.body?.quantity, 'Quantity');
    const repo = await getCartsRepository();
    res.json(await repo.updateItem(cartId, productId, quantity));
  } catch (error) {
    next(error);
  }
});

router.delete('/:cartId/items/:productId', async (req, res, next) => {
  try {
    const cartId = validateCartId(req.params.cartId);
    const productId = parseProductId(req.params.productId);
    const repo = await getCartsRepository();
    res.json(await repo.removeItem(cartId, productId));
  } catch (error) {
    next(error);
  }
});

export default router;
