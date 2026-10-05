import { BadRequestException, Body, Controller, Inject, Post, Res } from "@nestjs/common";
import type { User } from "@shopeer/domain";
import type { UserRegistrationDto, UserRegisterResponseDto, UserLoginDto } from "./Auth.dto.js";
import { AuthService } from "./Auth.service.js";
import { type Response } from "express";

@Controller("/auth")
export class AuthController { 
  public constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) { }

  @Post("/register")
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
  public async login(@Body() data: UserLoginDto, @Res({ passthrough: true }) res: Response): Promise<UserRegisterResponseDto> { 
    const user: User | null = await this.authService.login(data.username, data.password);

    if (!user) {
      throw new BadRequestException("Invalid credentials");
    }

    const token: string = this.authService.signToken(user);

    res.cookie("access_token", token);

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      suspended: user.suspended,
    };
  }
}