import { Inject, Injectable } from "@nestjs/common";
import { createId } from "@paralleldrive/cuid2";
import { Algorithm, hash, verify } from "@node-rs/argon2";
import { UserUseCase } from "@shopeer/case";
import { User } from "@shopeer/domain";
import { ConfigService } from "@nestjs/config";
import jwt from "jsonwebtoken";

@Injectable()
export class AuthService {
  public constructor(
    @Inject(UserUseCase)
    private readonly userUseCase: UserUseCase,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) { }

  public async registration(username: string, password: string): Promise<User | null> {
    const user: User | null = await this.userUseCase.fetchUserByUsername(username);

    if (user) {
      return null;
    }

    const newUser: User = new User({
      id: createId(),
      username,
      hashedPassword: await hash(password, { algorithm: Algorithm["Argon2id"], memoryCost: 20480, parallelism: 2, timeCost: 3, }),
      suspended: true,
    });

    return this.userUseCase.save(newUser);
  }

  public async login(username: string, password: string): Promise<User | null> {
    const user: User | null = await this.userUseCase.fetchUserByUsername(username);

    if (!user) {
      return null;
    }

    const result: boolean = await verify(user.hashedPassword, password);

    if (!result) {
      return null;
    }

    return user;
  }

  public signToken(user: User): string { 
    const secret: string = this.configService.getOrThrow("JWT_SECRET");
    return jwt.sign({ sub: user.id, }, secret, { expiresIn: "1h", });
  }

  public verifyToken(token: string): boolean { 
    const secret: string = this.configService.getOrThrow("JWT_SECRET");
    try {
      jwt.verify(token, secret, { complete: true, ignoreExpiration: false, });
      return true;
    } catch (e: any) { 
      return false;
    }
  }
}