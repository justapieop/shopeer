import { Global, Module } from "@nestjs/common";
import { InMemoryCacheManager } from "./InMemoryCacheManager.js";

@Global()
@Module({
  providers: [InMemoryCacheManager],
  exports: [InMemoryCacheManager],
})
export class InMemoryCacheModule { }
