import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { users, userProfiles, userSettings } from '../database/schema';
import { eq } from 'drizzle-orm';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
import { AuthSessionService } from './auth-session.service';
import { PasswordHasherService } from './password-hasher.service';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AuthResult {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private drizzle: DrizzleService,
    private jwtService: JwtService,
    private readonly sessions: AuthSessionService,
    private readonly passwordHasher: PasswordHasherService,
  ) { }

  async register(data: RegisterDto, userAgent?: string): Promise<AuthResult> {
    const db = this.drizzle.db;
    const username = this.normalizeUsername(data.username);

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing) {
      throw new ConflictException('Tên đăng nhập đã tồn tại!');
    }

    const hashedPassword = await this.passwordHasher.hash(data.password);
    const userId = await db.transaction(async (tx) => {
      const [newUser] = await tx.insert(users).values({
        username,
        displayName: data.displayName?.trim() || null,
        password: hashedPassword,
      });
      await Promise.all([
        tx.insert(userProfiles).values({ userId: newUser.insertId }),
        tx.insert(userSettings).values({ userId: newUser.insertId }),
      ]);
      return newUser.insertId;
    });

    return this.createAuthenticatedSession(userId, userAgent);
  }

  async login(loginDto: LoginDto, userAgent?: string): Promise<AuthResult> {
    const { username, password } = loginDto;

    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.username, this.normalizeUsername(username)))
      .limit(1);

    if (!user || !(await this.passwordHasher.verify(password, user.password))) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác!');
    }

    return this.createAuthenticatedSession(user.id, userAgent);
  }

  async logout(refreshToken: string | null) {
    await this.sessions.revokeSerialized(refreshToken);
  }

  async logoutAll(userId: number) {
    await this.sessions.revokeAllForUser(userId);
  }

  async refreshTokens(refreshToken: string | null): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Phiên đăng nhập không tồn tại.');
    }
    const rotated = await this.sessions.rotate(refreshToken);
    return {
      accessToken: await this.issueAccessToken(rotated.userId),
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: rotated.refreshToken,
    };
  }

  private async createAuthenticatedSession(userId: number, userAgent?: string): Promise<AuthResult> {
    const [accessToken, refreshToken] = await Promise.all([
      this.issueAccessToken(userId),
      this.sessions.create(userId, userAgent),
    ]);
    return { accessToken, expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS, refreshToken };
  }

  private issueAccessToken(userId: number) {
    return this.jwtService.signAsync(
      { userId },
      { secret: process.env.JWT_SECRET, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
  }

  private normalizeUsername(username: string) {
    return username.trim().toLowerCase();
  }
}
