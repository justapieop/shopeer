import {
  Domain,
  InvalidParametersError,
  type DomainDetails,
} from "./shared.js";
import { isAlphaNumericString, isBlankString } from "./utils.js";

export class User extends Domain {
  public readonly id!: string;
  public readonly username!: string;
  public readonly hashedPassword!: string;
  public readonly createdAt!: Date;
  public readonly suspended!: boolean;

  public constructor(protected readonly details: UserDetails) {
    super(details);

    this.id = details.id;
    this.username = details.username;
    this.hashedPassword = details.hashedPassword;
    this.createdAt = details.createdAt ?? new Date();
    this.suspended = details.suspended;
  }

  public validate(): InvalidParametersError | null {
    if (isBlankString(this.details.id)) {
      return new InvalidParametersError("id must not be blank");
    }

    if (!isAlphaNumericString(this.details.username)) {
      return new InvalidParametersError("username must be alphanumeric");
    }

    if (isBlankString(this.details.hashedPassword)) {
      return new InvalidParametersError("password must not be blank");
    }

    return null;
  }
}

export interface UserDetails extends DomainDetails {
  id: string;
  username: string;
  hashedPassword: string;
  createdAt?: Date;
  suspended: boolean;
}

export interface UserRepository {
  save(user: User): User | Promise<User>;
  fetchUserById(id: string): User | null | Promise<User | null>;
  fetchUserByUsername(username: string): User | null | Promise<User | null>;
}
