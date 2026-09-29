import {
  Cart,
  CartItem,
  NotFoundError,
  OutOfStockError,
  type Product,
  type User,
} from "@shopeer/domain";
import type { CartItemRepository, CartRepository, IdGenerator, ProductRepository, UserRepository } from "./ports.js";

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
    private readonly cartRepository: CartRepository,
    private readonly cartItemRepository: CartItemRepository,
    private readonly productRepository: ProductRepository,
    private readonly userRepository: UserRepository,
    private readonly idGenerator: IdGenerator,
  ) { }

  /** Returns the user's cart, creating an empty one on first use. */
  public async getCart(userId: string): Promise<CartView> {
    const cart: Cart = await this.getOrCreateCart(userId);
    return await this.buildView(cart);
  }

  /**
   * Adds `quantity` units of a product. If the product is already in the cart,
   * the quantities are added up.
   *
   * The stock check here only gives the user early feedback: it does not
   * reserve anything. Stock is reserved atomically at checkout.
   */
  public async addItem(userId: string, productId: string, quantity: number): Promise<CartView> {
    const cart: Cart = await this.getOrCreateCart(userId);
    const product: Product = await this.getProduct(productId);

    // Constructing the item validates `quantity` (positive integer).
    const item: CartItem = new CartItem({
      itemId: this.idGenerator.generate(),
      cartId: cart.cartId,
      productId,
      quantity,
    });

    const existing: CartItem | null = await this.cartItemRepository.fetchCartItem(cart.cartId, productId);
    const totalRequested: number = (existing?.quantity ?? 0) + quantity;

    if (!product.hasEnoughStock(totalRequested)) {
      throw new OutOfStockError([productId]);
    }

    await this.cartItemRepository.addOrIncreaseQuantity(item);

    return await this.buildView(cart);
  }

  /** Sets the quantity of a product that is already in the cart. */
  public async updateItemQuantity(userId: string, productId: string, quantity: number): Promise<CartView> {
    const cart: Cart = await this.getOrCreateCart(userId);
    const existing: CartItem | null = await this.cartItemRepository.fetchCartItem(cart.cartId, productId);

    if (!existing) {
      throw new NotFoundError(`Product ${productId} is not in the cart`);
    }

    // Validates `quantity` before touching the database.
    const updated: CartItem = existing.withQuantity(quantity);
    const product: Product = await this.getProduct(productId);

    if (!product.hasEnoughStock(quantity)) {
      throw new OutOfStockError([productId]);
    }

    await this.cartItemRepository.save(updated);

    return await this.buildView(cart);
  }

  public async removeItem(userId: string, productId: string): Promise<CartView> {
    const cart: Cart = await this.getOrCreateCart(userId);
    const deleted: boolean = await this.cartItemRepository.deleteCartItem(cart.cartId, productId);

    if (!deleted) {
      throw new NotFoundError(`Product ${productId} is not in the cart`);
    }

    return await this.buildView(cart);
  }

  public async clearCart(userId: string): Promise<CartView> {
    const cart: Cart = await this.getOrCreateCart(userId);
    await this.cartItemRepository.deleteCartItemsByCartId(cart.cartId);
    return await this.buildView(cart);
  }

  private async getOrCreateCart(userId: string): Promise<Cart> {
    const existing: Cart | null = await this.cartRepository.fetchCartByUserId(userId);

    if (existing) {
      return existing;
    }

    const user: User | null = await this.userRepository.fetchUserById(userId);

    if (!user) {
      throw new NotFoundError(`User ${userId} not found`);
    }

    // insertIfAbsent (not save) because two requests of the same user may get
    // here at the same time; the repository guarantees a single cart.
    return await this.cartRepository.insertIfAbsent(new Cart({
      cartId: this.idGenerator.generate(),
      userId,
    }));
  }

  private async getProduct(productId: string): Promise<Product> {
    const product: Product | null = await this.productRepository.fetchProductById(productId);

    if (!product) {
      throw new NotFoundError(`Product ${productId} not found`);
    }

    return product;
  }

  private async buildView(cart: Cart): Promise<CartView> {
    const items: CartItem[] = await this.cartItemRepository.fetchCartItemsByCartId(cart.cartId);
    const products: Product[] = await this.productRepository.fetchProductsByIds(
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
