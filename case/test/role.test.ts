import { InvalidParametersError, Permission, Role } from "@shopeer/domain";
import { describe, expect, it } from "vitest";

describe("Role (domain)", () => {
  const role = (permission: bigint): Role => new Role({ id: "r1", name: "Test", permission });

  // Each rule test checks the message too: any InvalidParametersError would
  // otherwise make it pass, even one raised by an unrelated rule.
  const expectRule = (create: () => Role, message: string): void => {
    expect(create).toThrow(InvalidParametersError);
    expect(create).toThrow(message);
  };

  it("gives every permission a distinct bit", () => {
    const offsets: number[] = Object.values(Permission).map((permission: Permission) => permission.offset);

    expect(new Set(offsets).size).toBe(offsets.length);
  });

  it("grants a member (6) buying and selling only", () => {
    const member: Role = role(6n);

    expect(member.hasPermission(Permission.Buy)).toBe(true);
    expect(member.hasPermission(Permission.Sell)).toBe(true);
    expect(member.hasPermission(Permission.ViewAnyProduct)).toBe(false);
    expect(member.hasPermission(Permission.Super)).toBe(false);
  });

  it("grants every permission to Super (1)", () => {
    expect(role(1n).getGrantedPermissions()).toEqual(Object.values(Permission));
  });

  it("grants nothing when no permission is given", () => {
    expect(new Role({ id: "r1", name: "Test" }).getGrantedPermissions()).toEqual([]);
  });

  it("accepts every preset role", () => {
    // Banned seller, banned buyer, member, support, order handler, admin, owner.
    for (const bits of [2n, 4n, 6n, 174n, 238n, 510n, 1n]) {
      expect(() => role(bits)).not.toThrow();
    }
  });

  it("requires ViewAnyProduct for EditAnyProduct", () => {
    expectRule(() => role(16n), "EditAnyProduct requires ViewAnyProduct");
    expect(() => role(24n)).not.toThrow();
  });

  it("requires ViewAnyOrder for EditAnyOrder", () => {
    expectRule(() => role(64n), "EditAnyOrder requires ViewAnyOrder");
    expect(() => role(96n)).not.toThrow();
  });

  it("requires ViewAnyUser for EditAnyUser", () => {
    expectRule(() => role(256n), "EditAnyUser requires ViewAnyUser");
    expect(() => role(384n)).not.toThrow();
  });

  it("lets Super hold an edit permission without its view permission", () => {
    expect(() => role(1n | 16n)).not.toThrow();
  });

  it("rejects a negative permission", () => {
    expectRule(() => role(-1n), "Role.permission must be a non-negative bigint");
  });
});
