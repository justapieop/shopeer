import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class Init1789712564933 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: "users",
            columns: [
                {
                    name: "id",
                    type: "text",
                    isPrimary: true,
                },
                {
                    name: "username",
                    type: "text",
                    isNullable: false,
                    isUnique: true,
                },
                {
                    name: "hashed_password",
                    type: "text",
                    isNullable: false,
                },
                {
                    name: "created_at",
                    type: "timestamptz",
                    isNullable: false,
                },
                {
                    name: "suspended",
                    type: "boolean",
                    isNullable: false,
                }
            ],
            checks: [
                {
                    expression: `username ~* '^[A-Za-z0-9]+$'`,
                    columnNames: ["username"],
                }
            ],
            indices: [
                {
                    columnNames: ["username"],
                    isUnique: true,
                },
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("users", true, true, true);
    }
}
