/**
 * @swagger
 * components:
 *   schemas:
 *     Cart:
 *       type: object
 *       required:
 *         - cartId
 *         - items
 *         - total
 *       properties:
 *         cartId:
 *           type: string
 *           format: uuid
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CartItem'
 *         total:
 *           type: number
 *           description: Total value of all cart items
 *     CartItem:
 *       type: object
 *       required:
 *         - productId
 *         - name
 *         - price
 *         - effectivePrice
 *         - quantity
 *         - lineTotal
 *       properties:
 *         productId:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         price:
 *           type: number
 *           description: Regular unit price before discount
 *         effectivePrice:
 *           type: number
 *           description: Unit price after discount, rounded to two decimal places
 *         imgName:
 *           type: string
 *           nullable: true
 *         sku:
 *           type: string
 *         unit:
 *           type: string
 *         discount:
 *           type: number
 *           nullable: true
 *         quantity:
 *           type: integer
 *           minimum: 1
 *         lineTotal:
 *           type: number
 */
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
