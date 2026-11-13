import { InvalidParametersError, NotFoundError, Permission, Product, Role, User } from "@shopeer/domain";
import { beforeEach, describe, expect, it } from "vitest";
import { CartUseCase } from "../src/cart.js";
import { OrderUseCase } from "../src/order.js";
import { ProductOwnershipUseCase } from "../src/productOwnership.js";
import { InMemoryCartItemRepository, InMemoryCartRepository, InMemoryCategoryRepository, InMemoryOrderRepository, InMemoryProductRepository, InMemoryRoleRepository, InMemoryUnitOfWork, InMemoryUserRepository, SequentialIdGenerator, makeProduct, makeUser, productDetails } from "./fakes.js";

describe("order ownership", () => {
  let products: InMemoryProductRepository, orders: InMemoryOrderRepository, users: InMemoryUserRepository;
  let cart: CartUseCase, checkout: OrderUseCase, ownership: ProductOwnershipUseCase;
  beforeEach(async () => {
    products = new InMemoryProductRepository();
    users = new InMemoryUserRepository();
    const lines = new InMemoryCartItemRepository();
    const roles = new InMemoryRoleRepository();
    const ids = new SequentialIdGenerator();
    orders = new InMemoryOrderRepository(products, lines);
    const work = new InMemoryUnitOfWork(new InMemoryCartRepository(), lines, products, orders, users, new InMemoryCategoryRepository(), roles);
    for (const id of ["buyer", "sellerA", "sellerB", "noSell"]) users.save(makeUser(id));
    roles.save(new Role({ id: "seller", name: "Seller", permission: 1n << BigInt(Permission.Sell.offset) }));
    roles.userRoles.set("sellerA", "seller"); roles.userRoles.set("sellerB", "seller");
    products.save(makeProduct("mug", 100, 10)); products.save(makeProduct("tote", 200, 10));
    ownership = new ProductOwnershipUseCase(work);
    cart = new CartUseCase(work, ids);
    checkout = new OrderUseCase(work, orders, ids);
  });
  it("keeps unassigned products and order lines hidden from all sellers", async () => {
    await cart.addItem("buyer", "mug", 1);
    const placed = await checkout.checkout("buyer");
    expect(placed.items[0]!.sellerId).toBeNull();
    expect(await checkout.listSellerOrders("sellerA")).toEqual([]);
    await expect(checkout.getSellerOrder("sellerA", placed.orderId)).rejects.toBeInstanceOf(NotFoundError);
  });
  it("limits each seller to their own lines and subtotal, while the buyer sees the whole order", async () => {
    await ownership.assignSeller("mug", "sellerA"); await ownership.assignSeller("tote", "sellerB");
    await cart.addItem("buyer", "mug", 2); await cart.addItem("buyer", "tote", 3);
    const placed = await checkout.checkout("buyer");
    expect((await checkout.getOrder("buyer", placed.orderId)).totalAmount).toBe(800);
    const a = await checkout.getSellerOrder("sellerA", placed.orderId);
    const b = await checkout.getSellerOrder("sellerB", placed.orderId);
    expect(a.items.map((item) => item.productId)).toEqual(["mug"]); expect(a.totalAmount).toBe(200);
    expect(b.items.map((item) => item.productId)).toEqual(["tote"]); expect(b.totalAmount).toBe(600);
    await expect(checkout.getOrder("sellerA", placed.orderId)).rejects.toBeInstanceOf(NotFoundError);
  });
  it("never transfers a historical order when product ownership or identity changes", async () => {
    await ownership.assignSeller("mug", "sellerA");
    await cart.addItem("buyer", "mug", 1);
    const placed = await checkout.checkout("buyer");
    await ownership.assignSeller("mug", "sellerB");
    const product = products.fetchProductById("mug")!;
    products.save(new Product({ ...productDetails(product), name: "Renamed product", price: 999 }));
    const historic = await checkout.getSellerOrder("sellerA", placed.orderId);
    expect(historic.items[0]!.name).toBe("Product mug"); expect(historic.totalAmount).toBe(100);
    await expect(checkout.getSellerOrder("sellerB", placed.orderId)).rejects.toBeInstanceOf(NotFoundError);
  });
  it("rejects unknown or inactive/non-selling assignment targets without changing ownership", async () => {
    await expect(ownership.assignSeller("mug", "missing")).rejects.toBeInstanceOf(NotFoundError);
    await expect(ownership.assignSeller("mug", "noSell")).rejects.toBeInstanceOf(InvalidParametersError);
    const original = users.fetchUserById("sellerA")!;
    users.save(new User({ id: original.id, username: original.username, hashedPassword: original.hashedPassword, suspended: true }));
    await expect(ownership.assignSeller("mug", "sellerA")).rejects.toBeInstanceOf(InvalidParametersError);
    expect(products.fetchProductById("mug")!.sellerId).toBeNull();
  });
});
