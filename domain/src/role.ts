import { DomainDetails, Domain, InvalidParametersError } from "./shared.js";
import { isBlankString } from "./utils.js";

export class Role extends Domain {
  public readonly id: string;
  public readonly name: string;
  private readonly permission: bigint;
  public readonly createdAt: Date;

  public constructor(details: RoleDetails) {
    super(details);

    this.id = details.id;
    this.name = details.name;
    this.permission = details.permission ?? 0n;
    this.createdAt = details.createdAt ?? new Date();
  }

  public validate(): InvalidParametersError | null {
    const details: RoleDetails = this.details as RoleDetails;

    if (isBlankString(details.id)) {
      return new InvalidParametersError(`Role.id must not be blank`);
    }

    if (isBlankString(details.name)) {
      return new InvalidParametersError(`Role.name must not be blank`);
    }

    if (details.permission !== undefined &&
      (typeof details.permission !== "bigint" || details.permission < 0n)) {
      return new InvalidParametersError(`Role.permission must be a non-negative bigint`);
    }

    return null;
  }

  public hasPermission(permission: Permission): boolean {
    if (!Number.isSafeInteger(permission.offset) || permission.offset < 0) {
      return false;
    }

    const superMask: bigint = 1n << BigInt(Permission.Super.offset);

    if ((this.permission & superMask) === superMask) {
      return true;
    }

    const requiredMask: bigint = 1n << BigInt(permission.offset);

    return (this.permission & requiredMask) === requiredMask;
  }

  public getGrantedPermissions(): Permission[] {
    return Object.values(Permission).filter(
      (permission: Permission): boolean => this.hasPermission(permission),
    );
  }

  public getPermissionBits(): bigint {
    return this.permission;
  }
}

export interface PermissionDefinition {
  readonly offset: number;
  readonly name: string;
  readonly description: string;
}

export const Permission: Readonly<Record<"Super", PermissionDefinition>> = {
  Super: {
    offset: 0,
    name: "Super",
    description: "Super role that has all permissions. Granting this permission is not recommended.",
  },
};

export type Permission = (typeof Permission)[keyof typeof Permission];

export interface RoleDetails extends DomainDetails {
  id: string;
  name: string;
  permission?: bigint;
  createdAt?: Date;
}