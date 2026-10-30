import { ForbiddenException, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthorizationUseCase } from "@shopeer/case";
import type { Permission } from "@shopeer/domain";
import type { Request } from "express";
import { getUserLookup, UserPipe } from "../decorators/User.decorator.js";
import { REQUIRED_PERMISSIONS_KEY } from "./permissions.metadata.js";

@Injectable()
export class PermissionsGuard implements CanActivate {
  public constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(UserPipe) private readonly userPipe: UserPipe,
    @Inject(AuthorizationUseCase) private readonly authorization: AuthorizationUseCase,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    // Method requirements add to controller requirements; neither can weaken the other.
    const permissions = this.reflector.getAllAndMerge<Permission[]>(
      REQUIRED_PERMISSIONS_KEY, [context.getClass(), context.getHandler()],
    );
    if (!permissions?.length) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = await this.userPipe.transform(getUserLookup(request));
    if (!await this.authorization.hasPermissions(user.id, permissions)) {
      throw new ForbiddenException("Missing required permissions");
    }
    return true;
  }
}
