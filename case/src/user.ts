import { type UserRepository, User } from "@shopeer/domain";

export class UserUseCase {
  public constructor(
    private readonly userRepository: UserRepository,
  ) { }

  public async save(user: User): Promise<User> { 
    return await this.userRepository.save(user);
  } 
}