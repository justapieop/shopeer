import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const configuration = new DocumentBuilder()
    .setTitle("Shopeer API")
    .setDescription("Public catalog, user registration and profiles, and authenticated cart and checkout operations. Monetary amounts are integer VND. Log in to set the HttpOnly access_token cookie used by protected routes.")
    .setVersion("1.0.0")
    .addCookieAuth("access_token", { type: "apiKey", in: "cookie", description: "Set by POST /auth/login; automatically sent by same-site browser requests." }, "cookie")
    .build();

  return SwaggerModule.createDocument(app, configuration, { autoTagControllers: false });
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup("docs", app, () => createOpenApiDocument(app), {
    jsonDocumentUrl: "/openapi.json",
    yamlDocumentUrl: "/openapi.yaml",
    swaggerOptions: { withCredentials: true },
  });
}
