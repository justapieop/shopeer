import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { UserUseCase } from "@shopeer/case";
import type { User } from "@shopeer/domain";

@Controller("/user")
export class UserController {
  public constructor(
    @Inject(UserUseCase)
    private readonly userUseCase: UserUseCase,
  ) { }

  @Get("/:id")
  public async getUser(@Param("id") id: string): Promise<User> {
    const user: User | null = await this.userUseCase.fetchUserById(id);

    if (!user) { 
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }
}