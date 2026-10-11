/**
 * In-memory implementations of the application ports (repositories).
 *
 * They let the use cases be tested without NestJS or PostgreSQL: this is the
 * practical payoff of the hexagonal architecture, since the use cases only
 * know the interfaces, so any "adapter" can be plugged in.
 */
import {
  Cart,
  CartItem,
  CartChangedError,
  Category,
  OutOfStockError,
  Product,
  User,
  type Order,
} from "@shopeer/domain";
import type { CartItemRepository, CartRepository, CategoryRepository, IdGenerator, OrderRepository, ProductRepository, RepositorySet, UnitOfWork, UserRepository } from "../src/ports.js";

export class SequentialIdGenerator implements IdGenerator {
  private next: number = 1;

  public generate(): string {
    return `id-${this.next++}`;
  }
}

export class InMemoryUserRepository implements UserRepository {
  public readonly users: Map<string, User> = new Map();

  public save(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  public fetchUserById(id: string): User | null {
    return this.users.get(id) ?? null;
  }

  public fetchUserByUsername(username: string): User | null {
    return [...this.users.values()].find((user: User) => user.username === username) ?? null;
  }
}

export class InMemoryCategoryRepository implements CategoryRepository {
  public readonly categories: Map<string, Category> = new Map();

  public save(category: Category): Category {
    this.categories.set(category.categoryId, category);
    return category;
  }

  public fetchCategoryById(categoryId: string): Category | null {
    return this.categories.get(categoryId) ?? null;
  }

  public fetchAllCategories(): Category[] {
    return [...this.categories.values()];
  }
}

export class InMemoryProductRepository implements ProductRepository {
  public readonly products: Map<string, Product> = new Map();

  public save(product: Product): Product {
    this.products.set(product.productId, product);
    return product;
  }

  public fetchProductById(productId: string): Product | null {
    return this.products.get(productId) ?? null;
  }

  public fetchProductsByIds(productIds: string[]): Product[] {
    return productIds
      .map((productId: string) => this.products.get(productId))
      .filter((product: Product | undefined): product is Product => product !== undefined);
  }

  public fetchAllProducts(): Product[] {
    return [...this.products.values()];
  }

  public fetchProductsByCategory(categoryId: string): Product[] {
    return [...this.products.values()].filter((product: Product) => product.categoryId === categoryId);
  }
}

export class InMemoryCartRepository implements CartRepository {
  public readonly carts: Map<string, Cart> = new Map();

  public save(cart: Cart): Cart {
    this.carts.set(cart.cartId, cart);
    return cart;
  }

  public fetchCartById(cartId: string): Cart | null {
    return this.carts.get(cartId) ?? null;
  }

  public fetchCartByUserId(userId: string): Cart | null {
    return [...this.carts.values()].find((cart: Cart) => cart.userId === userId) ?? null;
  }

  public insertIfAbsent(cart: Cart): Cart {
    return this.fetchCartByUserId(cart.userId) ?? this.save(cart);
  }
}

export class InMemoryCartItemRepository implements CartItemRepository {
  public readonly items: Map<string, CartItem> = new Map();

  public save(cartItem: CartItem): CartItem {
    this.items.set(cartItem.itemId, cartItem);
    return cartItem;
  }

  public fetchCartItemByItemId(itemId: string): CartItem | null {
    return this.items.get(itemId) ?? null;
  }

  public fetchCartItem(cartId: string, productId: string): CartItem | null {
    return [...this.items.values()]
      .find((item: CartItem) => item.cartId === cartId && item.productId === productId) ?? null;
  }

  public fetchCartItemsByCartId(cartId: string): CartItem[] {
    return [...this.items.values()].filter((item: CartItem) => item.cartId === cartId);
  }

  public fetchCartItemsByProductId(productId: string): CartItem[] {
    return [...this.items.values()].filter((item: CartItem) => item.productId === productId);
  }

  public addOrIncreaseQuantity(cartItem: CartItem): CartItem {
    const existing: CartItem | null = this.fetchCartItem(cartItem.cartId, cartItem.productId);

    if (existing) {
      return this.save(existing.withQuantity(existing.quantity + cartItem.quantity));
    }

    return this.save(cartItem);
  }

  public deleteCartItem(cartId: string, productId: string): boolean {
    const existing: CartItem | null = this.fetchCartItem(cartId, productId);
    return existing ? this.items.delete(existing.itemId) : false;
  }

  public deleteCartItemsByCartId(cartId: string): void {
    for (const item of this.fetchCartItemsByCartId(cartId)) {
      this.items.delete(item.itemId);
    }
  }
}

/** Follows the placeOrder contract in memory (single-threaded, so no locking needed). */
export class InMemoryOrderRepository implements OrderRepository {
  public readonly orders: Map<string, Order> = new Map();

  public constructor(
    private readonly productRepository: InMemoryProductRepository,
    private readonly cartItemRepository: InMemoryCartItemRepository,
  ) { }

  public placeOrder(order: Order, cartId: string): void {
    if (order.items.some((item) =>
      this.cartItemRepository.fetchCartItem(cartId, item.productId)?.quantity !== item.quantity,
    )) {
      throw new CartChangedError();
    }
    const outOfStock: string[] = order.items
      .filter((item) => !this.productRepository.fetchProductById(item.productId)?.hasEnoughStock(item.quantity))
      .map((item) => item.productId);

    if (outOfStock.length > 0) {
      throw new OutOfStockError(outOfStock);
    }

    for (const item of order.items) {
      const product: Product = this.productRepository.fetchProductById(item.productId)!;
      this.productRepository.save(new Product({ ...productDetails(product), stock: product.stock - item.quantity, }));
      this.cartItemRepository.deleteCartItem(cartId, item.productId);
    }

    this.orders.set(order.orderId, order);
  }

  public fetchOrderById(orderId: string): Order | null {
    return this.orders.get(orderId) ?? null;
  }

  public fetchOrdersByUserId(userId: string): Order[] {
    return [...this.orders.values()].filter((order: Order) => order.userId === userId);
  }
}

/** Serializes test transactions and restores repository maps on failure. */
export class InMemoryUnitOfWork implements UnitOfWork {
  private pending: Promise<void> = Promise.resolve();

  public constructor(
    private readonly carts: InMemoryCartRepository,
    private readonly cartItems: InMemoryCartItemRepository,
    private readonly products: InMemoryProductRepository,
    private readonly orders: InMemoryOrderRepository,
    private readonly users: InMemoryUserRepository = new InMemoryUserRepository(),
    private readonly categories: InMemoryCategoryRepository = new InMemoryCategoryRepository(),
  ) {}

  public async execute<T>(work: (repositories: RepositorySet) => Promise<T>): Promise<T> {
    const previous = this.pending;
    let release!: () => void;
    this.pending = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const restore = <V>(map: Map<string, V>): (() => void) => {
      const snapshot = new Map(map);
      return () => {
        map.clear();
        for (const [key, value] of snapshot) map.set(key, value);
      };
    };
    const snapshots = [
      restore(this.carts.carts), restore(this.cartItems.items),
      restore(this.products.products), restore(this.orders.orders),
      restore(this.users.users), restore(this.categories.categories),
    ];
    try {
      return await work({
        carts: this.carts, cartItems: this.cartItems,
        products: this.products, orders: this.orders,
        users: this.users, categories: this.categories,
      });
    } catch (error) {
      snapshots.forEach((reset) => reset());
      throw error;
    } finally {
      release();
    }
  }
}

export function productDetails(product: Product) {
  return {
    productId: product.productId,
    name: product.name,
    description: product.description,
    price: product.price,
    categoryId: product.categoryId,
    stock: product.stock,
    imageUrl: product.imageUrl,
  };
}

export function makeUser(id: string): User {
  return new User({ id, username: id.replace(/[^A-Za-z0-9]/g, ""), hashedPassword: "hash", suspended: false, });
}

export function makeProduct(productId: string, price: number, stock: number, categoryId: string = "cat-1"): Product {
  return new Product({
    productId,
    name: `Product ${productId}`,
    description: "A product",
    price,
    categoryId,
    stock,
    imageUrl: "https://example.com/image.png",
  });
}
