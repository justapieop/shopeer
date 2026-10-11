import {
  EmptyCartError,
  NotFoundError,
  Order,
  OrderItem,
  OutOfStockError,
  type Cart,
  type CartItem,
  type Product,
} from "@shopeer/domain";
import type {
  IdGenerator,
  OrderRepository,
  RepositorySet,
  UnitOfWork,
} from "./ports.js";

export class OrderUseCase {
  public constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly orderRepository: OrderRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  /**
   * Turns the user's whole cart into an order.
   *
   * Race condition: two users may check out the last unit of a product at the
   * same moment. The stock check below only fails fast in the common case; the
   * real guarantee comes from `OrderRepository.placeOrder`, which reserves stock
   * atomically and throws `OutOfStockError` for the buyer who comes second.
   */
  public async checkout(userId: string): Promise<Order> {
    return this.unitOfWork.execute((repositories) =>
      this.checkoutWithinTransaction(userId, repositories),
    );
  }

  private async checkoutWithinTransaction(
    userId: string,
    { carts, cartItems, products: productRepository, orders }: RepositorySet,
  ): Promise<Order> {
    const cart: Cart | null =
      await carts.fetchCartByUserId(userId);

    if (!cart) {
      throw new EmptyCartError();
    }

    const items: CartItem[] =
      await cartItems.fetchCartItemsByCartId(cart.cartId);

    if (items.length === 0) {
      throw new EmptyCartError();
    }

    const products: Product[] = await productRepository.fetchProductsByIds(
      items.map((item: CartItem) => item.productId),
    );
    const productsById: Map<string, Product> = new Map(
      products.map((product: Product) => [product.productId, product]),
    );

    const missing: string[] = items
      .map((item: CartItem) => item.productId)
      .filter((productId: string) => !productsById.has(productId));

    if (missing.length > 0) {
      throw new NotFoundError(
        `Product(s) no longer available: ${missing.join(", ")}`,
      );
    }

    const outOfStock: string[] = items
      .filter(
        (item: CartItem) =>
          !productsById.get(item.productId)!.hasEnoughStock(item.quantity),
      )
      .map((item: CartItem) => item.productId);

    if (outOfStock.length > 0) {
      throw new OutOfStockError(outOfStock);
    }

    const orderId: string = this.idGenerator.generate();
    const order: Order = new Order({
      orderId,
      userId,
      cartId: cart.cartId,
      status: "pending",
      items: items.map(
        (item: CartItem) =>
          new OrderItem({
            orderItemId: this.idGenerator.generate(),
            orderId,
            productId: item.productId,
            // Snapshot of today's price: later price changes do not alter this order.
            unitPrice: productsById.get(item.productId)!.price,
            quantity: item.quantity,
          }),
      ),
    });

    await orders.placeOrder(order, cart.cartId);

    return order;
  }

  /** The user's orders, newest first. */
  public async listOrders(userId: string): Promise<Order[]> {
    return await this.orderRepository.fetchOrdersByUserId(userId);
  }

  public async getOrder(userId: string, orderId: string): Promise<Order> {
    const order: Order | null =
      await this.orderRepository.fetchOrderById(orderId);

    // Someone else's order is reported as "not found" so that its existence is not revealed.
    if (!order || order.userId !== userId) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    return order;
  }
}
