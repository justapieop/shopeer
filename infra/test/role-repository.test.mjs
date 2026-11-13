import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Permission, Role } from "@shopeer/domain";
import { bigintToBigInt } from "../dist/nest/common/transformers.js";
import { RoleEntity, TypeOrmRoleRepository } from "../dist/nest/modules/role/Role.repository.js";

describe("bigintToBigInt", () => {
  it("reads the number produced by parseInt8 as a bigint", () => {
    assert.equal(bigintToBigInt.from(510), 510n);
  });

  it("reads a decimal string as a bigint", () => {
    assert.equal(bigintToBigInt.from("174"), 174n);
  });

  it("writes a bigint as a decimal string", () => {
    assert.equal(bigintToBigInt.to(6n), "6");
  });
});

describe("TypeOrmRoleRepository", () => {
  const member = Object.assign(new RoleEntity(), {
    id: "member", name: "Thành viên", permission: 6n, createdAt: new Date("2026-10-12T00:00:00Z"),
  });

  // Only the calls the reads make; the SQL itself is covered by the PostgreSQL test.
  const repository = (entity) => new TypeOrmRoleRepository({
    findOneBy: async () => entity,
    createQueryBuilder: () => ({
      where() { return this; },
      getOne: async () => entity,
    }),
  });

  it("maps a stored row to a Role that answers permission checks", async () => {
    const role = await repository(member).fetchRoleById("member");
    assert.ok(role instanceof Role);
    assert.equal(role.id, "member");
    assert.equal(role.getPermissionBits(), 6n);
    assert.equal(role.hasPermission(Permission.Sell), true);
    assert.equal(role.hasPermission(Permission.ViewAnyProduct), false);
  });

  it("maps the role found for a user", async () => {
    const role = await repository(member).fetchRoleByUserId("alice");
    assert.equal(role.name, "Thành viên");
  });

  it("returns null when nothing is found", async () => {
    assert.equal(await repository(null).fetchRoleById("missing"), null);
    assert.equal(await repository(null).fetchRoleByUserId("missing"), null);
  });
});
