import type { Cart, CartItem, Category, Order, Product, User } from "@shopeer/domain";

export interface CartRepository {
  save(cart: Cart): Cart | Promise<Cart>;
  fetchCartById(cartId: string): Cart | null | Promise<Cart | null>;
  fetchCartByUserId(userId: string): Cart | null | Promise<Cart | null>;
  /**
   * Stores `cart` unless its user already owns a cart, and returns the user's
   * cart either way. Must be atomic: two concurrent calls for the same user
   * end up with a single cart (each user has at most one cart).
   */
  insertIfAbsent(cart: Cart): Cart | Promise<Cart>;
}

export interface CartItemRepository {
  save(cartItem: CartItem): CartItem | Promise<CartItem>;
  fetchCartItemByItemId(itemId: string): CartItem | null | Promise<CartItem | null>;
  fetchCartItem(cartId: string, productId: string): CartItem | null | Promise<CartItem | null>;
  fetchCartItemsByCartId(cartId: string): CartItem[] | Promise<CartItem[]>;
  fetchCartItemsByProductId(productId: string): CartItem[] | Promise<CartItem[]>;
  /**
   * Adds `cartItem` to its cart. If the cart already has a line for the same
   * product, increases that line's quantity by `cartItem.quantity` instead.
   * Must be atomic so that two quick "add to cart" clicks never create two
   * lines for one product. Returns the resulting line.
   */
  addOrIncreaseQuantity(cartItem: CartItem): CartItem | Promise<CartItem>;
  /** Returns false when the cart has no line for this product. */
  deleteCartItem(cartId: string, productId: string): boolean | Promise<boolean>;
  deleteCartItemsByCartId(cartId: string): void | Promise<void>;
}

export interface CategoryRepository {
  save(category: Category): Category | Promise<Category>;
  fetchCategoryById(categoryId: string): Category | null | Promise<Category | null>;
  fetchAllCategories(): Category[] | Promise<Category[]>;
}

export interface OrderRepository {
  /**
   * Persists a new order created from the cart `cartId`, all or nothing:
   *
   * 1. Checks that the cart still holds exactly the ordered products and
   *    quantities, otherwise throws `CartChangedError`.
   * 2. Takes each item's quantity out of its product's stock. Must be safe
   *    against concurrent checkouts: stock never goes below zero and one unit
   *    is never sold twice. If any product lacks stock, throws
   *    `OutOfStockError` listing every such product.
   * 3. Saves the order with its items.
   * 4. Removes the ordered lines from the cart.
   *
   * When an error is thrown, nothing is changed.
   */
  placeOrder(order: Order, cartId: string): void | Promise<void>;
  fetchOrderById(orderId: string): Order | null | Promise<Order | null>;
  fetchOrdersByUserId(userId: string): Order[] | Promise<Order[]>;
}

export interface ProductRepository {
  save(product: Product): Product | Promise<Product>;
  fetchProductById(productId: string): Product | null | Promise<Product | null>;
  fetchProductsByIds(productIds: string[]): Product[] | Promise<Product[]>;
  fetchAllProducts(): Product[] | Promise<Product[]>;
  fetchProductsByCategory(categoryId: string): Product[] | Promise<Product[]>;
}

export interface UserRepository {
  save(user: User): User | Promise<User>;
  fetchUserById(id: string): User | null | Promise<User | null>;
  fetchUserByUsername(username: string): User | null | Promise<User | null>;
}

/**
 * Creates unique ids for new domain objects.
 * Use cases depend on this port instead of a concrete library, so the
 * infrastructure layer decides how ids look and tests can use predictable ids.
 */
export interface IdGenerator {
  generate(): string;
}
