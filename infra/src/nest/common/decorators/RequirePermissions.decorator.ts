import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import type { Permission } from "@shopeer/domain";
import { PermissionsGuard } from "../guards/Permissions.guard.js";
import { REQUIRED_PERMISSIONS_KEY } from "../guards/permissions.metadata.js";

export { REQUIRED_PERMISSIONS_KEY } from "../guards/permissions.metadata.js";

/**
 * Declares required permissions on a controller or route handler.
 * Requires all listed permissions. Import PermissionsModule in the feature module.
 * Controller and method requirements are combined.
 *
 * @example @RequirePermissions(Permission.Buy)
 */
export function RequirePermissions(...permissions: Permission[]): ClassDecorator & MethodDecorator {
  return applyDecorators(SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions), UseGuards(PermissionsGuard));
}
