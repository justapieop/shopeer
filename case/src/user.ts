import { type UserRepository, User } from "@shopeer/domain";

export class UserUseCase {
  public constructor(
    private readonly userRepository: UserRepository,
  ) { }

  public async save(user: User): Promise<User> { 
    return await this.userRepository.save(user);
  }

  public async fetchUserById(id: string): Promise<User | null> {
    return await this.userRepository.fetchUserById(id);
  }

  public async fetchUserByUsername(username: string): Promise<User | null> {
    return await this.userRepository.fetchUserByUsername(username);
  }
}