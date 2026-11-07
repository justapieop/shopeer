import { InvalidParametersError, NotFoundError, Permission } from "@shopeer/domain";
import type { UnitOfWork } from "./ports.js";

export class ProductOwnershipUseCase {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  public async assignSeller(productId: string, sellerId: string): Promise<void> {
    await this.unitOfWork.execute(async ({ products, users, roles }) => {
      const seller = await users.fetchUserById(sellerId);
      if (!seller) throw new NotFoundError("Seller not found");
      const role = await roles.fetchRoleByUserId(sellerId);
      if (seller.suspended || !role?.hasPermission(Permission.Sell)) throw new InvalidParametersError("Choose an active user with Sell permission");
      if (!await products.assignSeller(productId, sellerId)) throw new NotFoundError("Product not found");
    });
  }
}
