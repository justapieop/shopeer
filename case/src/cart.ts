import {
  Cart,
  CartItem,
  NotFoundError,
  OutOfStockError,
  type Product,
  type User,
} from "@shopeer/domain";
import type { IdGenerator, RepositorySet, UnitOfWork } from "./ports.js";

/** One line of the cart together with the product it refers to. */
export interface CartLine {
  item: CartItem;
  product: Product;
  /** product.price × item.quantity, in VND. */
  subtotal: number;
}

/** What the user sees: the cart, its lines and the totals. */
export interface CartView {
  cart: Cart;
  lines: CartLine[];
  totalQuantity: number;
  /** Sum of every line's subtotal, in VND. */
  totalAmount: number;
}

export class CartUseCase {
  public constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly idGenerator: IdGenerator,
  ) { }

  /** Returns the user's cart, creating an empty one on first use. */
  public async getCart(userId: string): Promise<CartView> {
    return this.unitOfWork.execute(async (repositories) => {
      const cart: Cart = await this.getOrCreateCart(userId, repositories);
      return await this.buildView(cart, repositories);
    });
  }

  /**
   * Adds `quantity` units of a product. If the product is already in the cart,
   * the quantities are added up.
   *
   * The stock check here only gives the user early feedback: it does not
   * reserve anything. Stock is reserved atomically at checkout.
   */
  public async addItem(userId: string, productId: string, quantity: number): Promise<CartView> {
    return this.unitOfWork.execute(async (repositories) => {
      const cart: Cart = await this.getOrCreateCart(userId, repositories);
      const product: Product = await this.getProduct(productId, repositories);

      // Constructing the item validates `quantity` (positive integer).
      const item: CartItem = new CartItem({
        itemId: this.idGenerator.generate(),
        cartId: cart.cartId,
        productId,
        quantity,
      });

      const existing: CartItem | null = await repositories.cartItems.fetchCartItem(cart.cartId, productId);
      const totalRequested: number = (existing?.quantity ?? 0) + quantity;

      if (!product.hasEnoughStock(totalRequested)) {
        throw new OutOfStockError([productId]);
      }

      await repositories.cartItems.addOrIncreaseQuantity(item);

      return await this.buildView(cart, repositories);
    });
  }

  /** Sets the quantity of a product that is already in the cart. */
  public async updateItemQuantity(userId: string, productId: string, quantity: number): Promise<CartView> {
    return this.unitOfWork.execute(async (repositories) => {
      const cart: Cart = await this.getOrCreateCart(userId, repositories);
      const existing: CartItem | null = await repositories.cartItems.fetchCartItem(cart.cartId, productId);

      if (!existing) {
        throw new NotFoundError(`Product ${productId} is not in the cart`);
      }

      // Validates `quantity` before touching the database.
      const updated: CartItem = existing.withQuantity(quantity);
      const product: Product = await this.getProduct(productId, repositories);

      if (!product.hasEnoughStock(quantity)) {
        throw new OutOfStockError([productId]);
      }

      await repositories.cartItems.save(updated);

      return await this.buildView(cart, repositories);
    });
  }

  public async removeItem(userId: string, productId: string): Promise<CartView> {
    return this.unitOfWork.execute(async (repositories) => {
      const cart: Cart = await this.getOrCreateCart(userId, repositories);
      const deleted: boolean = await repositories.cartItems.deleteCartItem(cart.cartId, productId);

      if (!deleted) {
        throw new NotFoundError(`Product ${productId} is not in the cart`);
      }

      return await this.buildView(cart, repositories);
    });
  }

  public async clearCart(userId: string): Promise<CartView> {
    return this.unitOfWork.execute(async (repositories) => {
      const cart: Cart = await this.getOrCreateCart(userId, repositories);
      await repositories.cartItems.deleteCartItemsByCartId(cart.cartId);
      return await this.buildView(cart, repositories);
    });
  }

  private async getOrCreateCart(userId: string, repositories: RepositorySet): Promise<Cart> {
    const existing: Cart | null = await repositories.carts.fetchCartByUserId(userId);

    if (existing) {
      return existing;
    }

    const user: User | null = await repositories.users.fetchUserById(userId);

    if (!user) {
      throw new NotFoundError(`User ${userId} not found`);
    }

    // insertIfAbsent (not save) because two requests of the same user may get
    // here at the same time; the repository guarantees a single cart.
    return await repositories.carts.insertIfAbsent(new Cart({
      cartId: this.idGenerator.generate(),
      userId,
    }));
  }

  private async getProduct(productId: string, repositories: RepositorySet): Promise<Product> {
    const product: Product | null = await repositories.products.fetchProductById(productId);

    if (!product) {
      throw new NotFoundError(`Product ${productId} not found`);
    }

    return product;
  }

  private async buildView(cart: Cart, repositories: RepositorySet): Promise<CartView> {
    const items: CartItem[] = await repositories.cartItems.fetchCartItemsByCartId(cart.cartId);
    const products: Product[] = await repositories.products.fetchProductsByIds(
      items.map((item: CartItem) => item.productId),
    );
    const productsById: Map<string, Product> = new Map(
      products.map((product: Product) => [product.productId, product]),
    );

    const lines: CartLine[] = [];

    for (const item of items) {
      const product: Product | undefined = productsById.get(item.productId);

      // Cart lines are deleted together with their product (foreign key
      // cascade), so a missing product only happens in a concurrent deletion.
      if (product) {
        lines.push({ item, product, subtotal: product.price * item.quantity, });
      }
    }

    return {
      cart,
      lines,
      totalQuantity: lines.reduce((sum: number, line: CartLine) => sum + line.item.quantity, 0),
      totalAmount: lines.reduce((sum: number, line: CartLine) => sum + line.subtotal, 0),
    };
  }
}
