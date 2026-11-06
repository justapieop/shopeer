import { BadRequestException, Body, Controller, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { User } from "@shopeer/domain";
import { UserRegistrationDto, UserRegisterResponseDto, UserLoginDto } from "./Auth.dto.js";
import { AuthService } from "./Auth.service.js";
import { type Request, type Response } from "express";
import { ApiBody, ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";
import { ConfigService } from "@nestjs/config";
import { ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_PATH, REFRESH_TOKEN_TTL_SECONDS } from "../../common/auth-cookie.js";

@Controller("/auth")
@ApiTags("Authentication")
@ApiErrors({ status: 500, description: "An unexpected server error occurred." })
export class AuthController { 
  public constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) { }

  @Post("/register")
  @ApiOperation({ summary: "Register a user" })
  @ApiBody({ type: UserRegistrationDto })
  @ApiCreatedResponse({ type: UserRegisterResponseDto, description: "The new user is active by default." })
  @ApiErrors(
    { status: 400, description: "Invalid registration data." },
    { status: 409, description: "The username is already registered, including a concurrent registration." },
  )
  public async register(@Body() data: UserRegistrationDto): Promise<UserRegisterResponseDto> {
    const user: User = await this.authService.registration(data.username, data.password);

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      suspended: user.suspended,
    };
  }

  @Post("/login")
  @ApiOperation({ summary: "Log in", description: "Verifies credentials and sets HttpOnly access_token (one hour) and refresh_token (seven days) cookies. Tokens are not returned in JSON." })
  @ApiBody({ type: UserLoginDto })
  @ApiCreatedResponse({
    type: UserRegisterResponseDto,
    description: "The authenticated user. The current login endpoint responds with HTTP 201.",
    headers: { "Set-Cookie": { description: "Access and refresh JWT cookies lasting one hour and seven days respectively; HttpOnly, SameSite=Strict, and Secure in production. Refresh cookie is scoped to /auth/refresh.", schema: { type: "string" } } },
  })
  @ApiErrors({ status: 400, description: "The username or password is invalid." })
  public async login(@Body() data: UserLoginDto, @Res({ passthrough: true }) res: Response): Promise<UserRegisterResponseDto> { 
    const user: User | null = await this.authService.login(data.username, data.password);

    if (!user) {
      throw new BadRequestException("Invalid credentials");
    }

    const token: string = this.authService.signToken(user);
    const refreshToken: string = this.authService.signRefreshToken(user);

    this.setAccessCookie(res, token);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: REFRESH_TOKEN_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      suspended: user.suspended,
    };
  }

  @Post("/refresh")
  @HttpCode(200)
  @ApiCookieAuth("refresh-cookie")
  @ApiOperation({ summary: "Refresh access token", description: "Validates the refresh_token cookie and the current user, then sets a new one-hour access_token cookie. The refresh token keeps its original expiry." })
  @ApiOkResponse({ type: UserRegisterResponseDto, headers: { "Set-Cookie": { description: "New HttpOnly access_token cookie lasting one hour.", schema: { type: "string" } } } })
  @ApiErrors(
    { status: 401, description: "Missing, invalid, or expired refresh token, or user no longer exists." },
    { status: 403, description: "User is suspended." },
  )
  public async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<UserRegisterResponseDto> {
    const user = await this.authService.refresh(req.cookies?.[REFRESH_TOKEN_COOKIE]);
    this.setAccessCookie(res, this.authService.signToken(user));
    return { id: user.id, username: user.username, createdAt: user.createdAt, suspended: user.suspended };
  }

  private setAccessCookie(res: Response, token: string): void {
    res.cookie(ACCESS_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
  }
}
