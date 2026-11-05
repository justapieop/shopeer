import { Controller, Get, Header, Inject, NotFoundException, Param } from "@nestjs/common";
import { UserUseCase } from "@shopeer/case";
import type { User } from "@shopeer/domain";
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";
import { UserResponseDto } from "./User.dto.js";
import { User as AuthenticatedUser } from "../../common/decorators/User.decorator.js";

@Controller("/user")
@ApiTags("Users")
@ApiErrors({ status: 500, description: "An unexpected server error occurred." })
export class UserController {
  public constructor(
    @Inject(UserUseCase)
    private readonly userUseCase: UserUseCase,
  ) { }

  @Get("/me")
  @Header("Cache-Control", "private, no-store")
  @ApiCookieAuth("cookie")
  @ApiOperation({ summary: "Get the authenticated user's profile" })
  @ApiOkResponse({ type: UserResponseDto, description: "Current user fields; excludes credentials and internal domain details." })
  @ApiErrors(
    { status: 401, description: "Missing, invalid, or expired access token, or the user no longer exists." },
    { status: 403, description: "The authenticated user is suspended." },
  )
  public getMe(@AuthenticatedUser() user: User): UserResponseDto {
    return UserResponseDto.from(user);
  }

  @Get("/:id")
  @ApiOperation({ summary: "Get a public user profile" })
  @ApiParam({ name: "id", type: String, description: "User ID.", example: "user-1" })
  @ApiOkResponse({ type: UserResponseDto, description: "Public user fields; excludes credentials and internal domain details." })
  @ApiErrors({ status: 404, description: "The user does not exist." })
  public async getUser(@Param("id") id: string): Promise<UserResponseDto> {
    const user: User | null = await this.userUseCase.fetchUserById(id);

    if (!user) { 
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return UserResponseDto.from(user);
  }
}
