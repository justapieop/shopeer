import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const configuration = new DocumentBuilder()
    .setTitle("Shopeer API")
    .setDescription("Public catalog, user registration and profiles, and authenticated cart and checkout operations. Monetary amounts are integer VND. Protected routes require a JWT in the Authorization: Bearer header; login sets an access_token cookie but the authentication decorator does not read cookies.")
    .setVersion("1.0.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT", description: "JWT signed by the login endpoint." }, "bearer")
    .build();

  return SwaggerModule.createDocument(app, configuration, { autoTagControllers: false });
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup("docs", app, () => createOpenApiDocument(app), {
    jsonDocumentUrl: "/openapi.json",
    yamlDocumentUrl: "/openapi.yaml",
  });
}
