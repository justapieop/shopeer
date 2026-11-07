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
  Role,
  User,
  UsernameAlreadyExistsError,
  ConflictError,
  Order,
} from "@shopeer/domain";
import type { CartItemRepository, CartRepository, CategoryRepository, IdGenerator, OrderRepository, ProductRepository, RepositorySet, RoleRepository, UnitOfWork, UserRepository } from "../src/ports.js";
import { paginationOffset, type Pagination } from "../src/pagination.js";

export class SequentialIdGenerator implements IdGenerator {
  private next: number = 1;

  public generate(): string {
    return `id-${this.next++}`;
  }
}

export class InMemoryUserRepository implements UserRepository {
  public readonly users: Map<string, User> = new Map();

  public create(user: User): User {
    if (this.fetchUserByUsername(user.username)) throw new UsernameAlreadyExistsError(user.username);
    if (this.users.has(user.id)) throw new ConflictError("User ID already exists");
    return this.save(user);
  }

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

export class InMemoryRoleRepository implements RoleRepository {
  public readonly roles: Map<string, Role> = new Map();
  /** userId → roleId, the in-memory counterpart of users.role_id. */
  public readonly userRoles: Map<string, string> = new Map();

  public save(role: Role): Role {
    this.roles.set(role.id, role);
    return role;
  }

  public fetchRoleById(roleId: string): Role | null {
    return this.roles.get(roleId) ?? null;
  }

  public fetchRoleByUserId(userId: string): Role | null {
    const roleId: string | undefined = this.userRoles.get(userId);
    return roleId === undefined ? null : this.fetchRoleById(roleId);
  }
}

export class InMemoryProductRepository implements ProductRepository {
  public assignSeller(productId: string, sellerId: string): boolean {
    const product = this.products.get(productId);
    if (!product) return false;
    this.save(new Product({ ...productDetails(product), sellerId }));
    return true;
  }
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

  public fetchAllProducts(pagination: Pagination): Product[] {
    const offset = paginationOffset(pagination);
    return [...this.products.values()]
      .sort((a, b) => a.name.localeCompare(b.name) || a.productId.localeCompare(b.productId))
      .slice(offset, offset + pagination.limit);
  }

  public fetchProductsByCategory(categoryId: string, pagination: Pagination): Product[] {
    const offset = paginationOffset(pagination);
    return [...this.products.values()].filter((product: Product) => product.categoryId === categoryId)
      .sort((a, b) => a.name.localeCompare(b.name) || a.productId.localeCompare(b.productId))
      .slice(offset, offset + pagination.limit);
  }
}

export class InMemoryCartRepository implements CartRepository {
  // The in-memory adapter executes synchronously; database tests cover locking.
  public lockCart(cartId: string): void | Promise<void> {
    if (!this.carts.has(cartId)) throw new Error(`Cart ${cartId} not found`);
  }
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
  public updateQuantity(item: CartItem): boolean {
    const existing = this.items.get(item.itemId);
    if (!existing || existing.cartId !== item.cartId || existing.productId !== item.productId) return false;
    this.items.set(item.itemId, item);
    return true;
  }
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
  public transitionStatus(orderId: string, from: Order["status"], to: Order["status"]): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.status !== from) return false;
    this.orders.set(orderId, new Order({ orderId, userId: order.userId, cartId: order.cartId, items: [...order.items], createdAt: order.createdAt, status: to }));
    return true;
  }
  public fetchOrderBySellerId(sellerId: string, orderId: string): Order | null {
    const order = this.orders.get(orderId);
    const items = order?.items.filter((item) => item.sellerId === sellerId) ?? [];
    return order && items.length ? new Order({ orderId: order.orderId, cartId: order.cartId, userId: order.userId, status: order.status, createdAt: order.createdAt, items }) : null;
  }
  public fetchOrdersBySellerId(sellerId: string, pagination: Pagination): Order[] {
    return [...this.orders.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.orderId.localeCompare(a.orderId))
      .map((order) => this.fetchOrderBySellerId(sellerId, order.orderId)).filter((order): order is Order => order !== null)
      .slice(paginationOffset(pagination), paginationOffset(pagination) + pagination.limit);
  }
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

  public fetchOrdersByUserId(userId: string, pagination: Pagination): Order[] {
    const offset = paginationOffset(pagination);
    return [...this.orders.values()].filter((order: Order) => order.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.orderId.localeCompare(a.orderId))
      .slice(offset, offset + pagination.limit);
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
    private readonly roles: InMemoryRoleRepository = new InMemoryRoleRepository(),
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
      restore(this.roles.roles), restore(this.roles.userRoles),
    ];
    try {
      return await work({
        carts: this.carts, cartItems: this.cartItems,
        products: this.products, orders: this.orders,
        users: this.users, categories: this.categories,
        roles: this.roles,
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
    sellerId: product.sellerId,
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
