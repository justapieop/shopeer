import type { Request } from "express";
import { createParamDecorator, type ExecutionContext, ForbiddenException, Inject, Injectable, type PipeTransform, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserUseCase } from "@shopeer/case";
import type { User as DomainUser } from "@shopeer/domain";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_COOKIE } from "../auth-cookie.js";

interface UserLookup {
  token: string;
  options: UserOptions;
}

@Injectable()
export class UserPipe implements PipeTransform<UserLookup, Promise<DomainUser>> {
  public constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(UserUseCase)
    private readonly userUseCase: UserUseCase,
  ) { }

  public async transform({ token, options }: UserLookup): Promise<DomainUser> {
    const secret: string = this.configService.getOrThrow("JWT_SECRET");
    let payload: jwt.JwtPayload | string;

    try {
      payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }

    if (typeof payload === "string" || typeof payload.sub !== "string" || !payload.sub.trim()) {
      throw new UnauthorizedException("Invalid access token subject");
    }

    const user: DomainUser | null = await this.userUseCase.fetchUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (user.suspended && !(options.allowSuspended ?? defaultUserFetchOptions.allowSuspended)) {
      throw new ForbiddenException("User is suspended");
    }

    return user;
  }
}

export function getUserLookup(request: Request, options: UserOptions = defaultUserFetchOptions): UserLookup {
  const token: unknown = request.cookies?.[ACCESS_TOKEN_COOKIE];

  if (token === undefined) {
    throw new UnauthorizedException("Missing access token");
  }

  if (typeof token !== "string" || !token.trim()) {
    throw new UnauthorizedException("Invalid access token cookie");
  }

  return { token, options };
}

const userParameter = createParamDecorator((data: UserOptions, context: ExecutionContext): UserLookup =>
  getUserLookup(context.switchToHttp().getRequest<Request>(), data),
);

export function User(options: UserOptions = defaultUserFetchOptions): ParameterDecorator {
  return userParameter(options, UserPipe);
}

export interface UserOptions {
  allowSuspended?: boolean,
}

export const defaultUserFetchOptions: UserOptions = {
  allowSuspended: false,
};
