import { createParamDecorator, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const USER_ID_HEADER: string = "x-user-id";

/**
 * TEMPORARY — NOT SECURE. Reads the current user's id from the `X-User-Id`
 * request header, so the cart/order flow can be tested before the JWT guard
 * (An's task) is ready. Anyone can put any id in this header.
 *
 * TODO(An): once the auth guard verifies the `access_token` cookie, replace
 * this decorator with the one that returns the authenticated user's id.
 * Controllers only use `@CurrentUserId() userId: string`, so only this file
 * needs to change.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request: Request = context.switchToHttp().getRequest<Request>();
    const userId: string | undefined = request.header(USER_ID_HEADER)?.trim();

    if (!userId) {
      throw new UnauthorizedException(`Missing ${USER_ID_HEADER} header`);
    }

    return userId;
  },
);
