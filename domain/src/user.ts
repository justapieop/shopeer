import {
  Domain,
  InvalidParametersError,
  type DomainDetails,
} from "./shared.js";
import { isAlphaNumericString, isBlankString } from "./utils.js";

export class User extends Domain {
  public readonly userID!: string;
  public readonly username!: string;
  public readonly hashedPassword!: string;
  public readonly createdAt!: Date;
  public readonly suspended!: boolean;
  public readonly email!: string;

  public constructor(protected readonly details: UserDetails) {
    super(details);

    this.userID = details.userID;
    this.username = details.username;
    this.hashedPassword = details.hashedPassword;
    this.createdAt = details.createdAt ?? new Date();
    this.suspended = details.suspended;
    this.email = details.email;
  }

  public validate(): InvalidParametersError | null {
    if (isBlankString(this.details.userID)) {
      return new InvalidParametersError("userID must not be blank");
    }

    if (!isAlphaNumericString(this.details.username)) {
      return new InvalidParametersError("username must be alphanumeric");
    }

    if (isBlankString(this.details.hashedPassword)) {
      return new InvalidParametersError("password must not be blank");
    }

    if (isBlankString(this.details.email)) {
      return new InvalidParametersError("email must not be blank");
    }

    return null;
  }
}

export interface UserDetails extends DomainDetails {
  userID: string;
  username: string;
  hashedPassword: string;
  createdAt?: Date;
  suspended: boolean;
  email: string;
}

export interface UserRepository {
  save(user: User): User | Promise<User>;
  fetchUserById(userID: string): User | null | Promise<User | null>;
  fetchUserByUsername(username: string): User | null | Promise<User | null>;
}
