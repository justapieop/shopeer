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

    // Read from details: validate() runs inside super(), before this.permission is set.
    const bits: bigint = details.permission ?? 0n;

    // Super already has every permission, so its pairs are complete by definition.
    if (!hasBit(bits, Permission.Super.offset)) {
      for (const [permission, required] of RequiredPermissions) {
        if (hasBit(bits, permission.offset) && !hasBit(bits, required.offset)) {
          return new InvalidParametersError(
            `Role.permission ${permission.name} requires ${required.name}`,
          );
        }
      }
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

export type PermissionName =
  | "Super"
  | "Buy"
  | "Sell"
  | "ViewAnyProduct"
  | "EditAnyProduct"
  | "ViewAnyOrder"
  | "EditAnyOrder"
  | "ViewAnyUser"
  | "EditAnyUser";

/**
 * Every permission and its bit in Role.permission. Bits are stored in the
 * database, so an offset must never be changed or reused once released.
 *
 * Buy and Sell cover the user's own things (own cart, own products, orders
 * they bought or sold). The "Any" permissions reach other users' things.
 */
export const Permission: Readonly<Record<PermissionName, PermissionDefinition>> = {
  Super: {
    offset: 0,
    name: "Super",
    description: "Super role that has all permissions. Granting this permission is not recommended. "
      + "Only Super can manage categories and create, edit or assign roles.",
  },
  Buy: {
    offset: 1,
    name: "Buy",
    description: "Use the cart, check out, and view or cancel the orders the user bought.",
  },
  Sell: {
    offset: 2,
    name: "Sell",
    description: "List, edit, hide and remove the user's own products, and handle the orders that contain them.",
  },
  ViewAnyProduct: {
    offset: 3,
    name: "ViewAnyProduct",
    description: "View other users' products, including hidden and removed ones, and every shop's sales figures.",
  },
  EditAnyProduct: {
    offset: 4,
    name: "EditAnyProduct",
    description: "Edit, hide and remove other users' products. Requires ViewAnyProduct.",
  },
  ViewAnyOrder: {
    offset: 5,
    name: "ViewAnyOrder",
    description: "View other users' orders and their transactions.",
  },
  EditAnyOrder: {
    offset: 6,
    name: "EditAnyOrder",
    description: "Change the status of other users' orders and transactions, e.g. cancel or refund. Requires ViewAnyOrder.",
  },
  ViewAnyUser: {
    offset: 7,
    name: "ViewAnyUser",
    description: "View other users' non-public details: suspension, role and creation date.",
  },
  EditAnyUser: {
    offset: 8,
    name: "EditAnyUser",
    description: "Suspend, unsuspend and edit other users, except Super users. Cannot assign roles. Requires ViewAnyUser.",
  },
};

export type Permission = (typeof Permission)[keyof typeof Permission];

/** [permission, the permission it requires]: editing someone else's things needs seeing them first. */
const RequiredPermissions: ReadonlyArray<readonly [Permission, Permission]> = [
  [Permission.EditAnyProduct, Permission.ViewAnyProduct],
  [Permission.EditAnyOrder, Permission.ViewAnyOrder],
  [Permission.EditAnyUser, Permission.ViewAnyUser],
];

function hasBit(bits: bigint, offset: number): boolean {
  const mask: bigint = 1n << BigInt(offset);

  return (bits & mask) === mask;
}

export interface RoleDetails extends DomainDetails {
  id: string;
  name: string;
  permission?: bigint;
  createdAt?: Date;
}