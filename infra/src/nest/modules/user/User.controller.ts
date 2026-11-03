import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { UserUseCase } from "@shopeer/case";
import type { User } from "@shopeer/domain";
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";
import { UserResponseDto } from "./User.dto.js";

@Controller("/user")
@ApiTags("Users")
@ApiErrors({ status: 500, description: "An unexpected server error occurred." })
export class UserController {
  public constructor(
    @Inject(UserUseCase)
    private readonly userUseCase: UserUseCase,
  ) { }

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
