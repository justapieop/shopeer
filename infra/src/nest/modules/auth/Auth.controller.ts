import { BadRequestException, Body, Controller, Inject, Post, Res } from "@nestjs/common";
import type { User } from "@shopeer/domain";
import { UserRegistrationDto, UserRegisterResponseDto, UserLoginDto } from "./Auth.dto.js";
import { AuthService } from "./Auth.service.js";
import { type Response } from "express";
import { ApiBody, ApiCreatedResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";
import { ConfigService } from "@nestjs/config";
import { ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_TTL_SECONDS } from "../../common/auth-cookie.js";

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
  @ApiErrors({ status: 400, description: "Invalid registration data or a username that is already registered." })
  public async register(@Body() data: UserRegistrationDto): Promise<UserRegisterResponseDto> {
    const user: User | null = await this.authService.registration(data.username, data.password);

    if (!user) { 
      throw new BadRequestException(`User with username ${data.username} already exists`);
    }

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      suspended: user.suspended,
    };
  }

  @Post("/login")
  @ApiOperation({ summary: "Log in", description: "Verifies credentials and sets the HttpOnly access_token cookie used by protected routes. The token is not returned in JSON." })
  @ApiBody({ type: UserLoginDto })
  @ApiCreatedResponse({
    type: UserRegisterResponseDto,
    description: "The authenticated user. The current login endpoint responds with HTTP 201.",
    headers: { "Set-Cookie": { description: "JWT cookie lasting one hour; Secure in production.", schema: { type: "string", example: "access_token=<JWT>; Max-Age=3600; Path=/; HttpOnly; SameSite=Strict" } } },
  })
  @ApiErrors({ status: 400, description: "The username or password is invalid." })
  public async login(@Body() data: UserLoginDto, @Res({ passthrough: true }) res: Response): Promise<UserRegisterResponseDto> { 
    const user: User | null = await this.authService.login(data.username, data.password);

    if (!user) {
      throw new BadRequestException("Invalid credentials");
    }

    const token: string = this.authService.signToken(user);

    res.cookie(ACCESS_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      suspended: user.suspended,
    };
  }
}
