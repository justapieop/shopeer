import type { Permission } from "@shopeer/domain";
import type { RoleRepository } from "./ports.js";

export class AuthorizationUseCase {
  public constructor(private readonly roleRepository: RoleRepository) {}

  public async hasPermissions(userId: string, permissions: readonly Permission[]): Promise<boolean> {
    const role = await this.roleRepository.fetchRoleByUserId(userId);
    return role !== null && permissions.every((permission) => role.hasPermission(permission));
  }
}
