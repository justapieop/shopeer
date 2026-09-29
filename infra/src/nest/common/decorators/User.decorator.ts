import type { Request } from "express";
import { createParamDecorator, type ExecutionContext, ForbiddenException, Inject, Injectable, type PipeTransform, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserUseCase } from "@shopeer/case";
import type { User as DomainUser } from "@shopeer/domain";
import jwt from "jsonwebtoken";

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

const userParameter = createParamDecorator((data: UserOptions, context: ExecutionContext): UserLookup => {
  const request: Request = context.switchToHttp().getRequest();

  const tokenHeader: string | undefined = request.headers.authorization;

  if (!tokenHeader) {
    throw new UnauthorizedException("Missing access token");
  }

  const match: RegExpExecArray | null = /^Bearer ([^\s]+)$/i.exec(tokenHeader);

  if (!match?.[1]) {
    throw new UnauthorizedException("Invalid Authorization header");
  }

  return { token: match[1], options: data };
});

export function User(options: UserOptions = defaultUserFetchOptions): ParameterDecorator {
  return userParameter(options, UserPipe);
}

export interface UserOptions {
  allowSuspended?: boolean,
  permissons?: number,
}

export const defaultUserFetchOptions: UserOptions = {
  allowSuspended: false,
  permissons: 0
};
