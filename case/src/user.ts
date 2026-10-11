import { User } from "@shopeer/domain";
import type { RepositorySet, UnitOfWork, UserRepository } from "./ports.js";

export class UserUseCase {
  public constructor(
    private readonly unitOfWork: UnitOfWork<Pick<RepositorySet, "users">>,
    private readonly userRepository: UserRepository,
  ) { }

  public async save(user: User): Promise<User> { 
    return this.unitOfWork.execute(async ({ users }) => users.save(user));
  }

  public async fetchUserById(id: string): Promise<User | null> {
    return await this.userRepository.fetchUserById(id);
  }

  public async fetchUserByUsername(username: string): Promise<User | null> {
    return await this.userRepository.fetchUserByUsername(username);
  }
}
