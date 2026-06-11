import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { users, userProfiles, userSettings } from '../database/schema';
import { eq, or } from 'drizzle-orm';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
import { AuthSessionService } from './auth-session.service';
import { PasswordHasherService } from './password-hasher.service';
import { PushSubscriptionsService } from '../push-notifications/push-subscriptions.service';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants';
import { normalizeEmail } from './email-address';
import { AuthRecoveryService } from './auth-recovery.service';
import {
  assertPasswordFitsBcrypt,
  BCRYPT_MAX_PASSWORD_BYTES,
} from './password-policy';

const DUMMY_PASSWORD_HASH =
  '$2b$12$t45DXE.uoPn.cmRdfllA6eTM/0ZObK1/mrcXDOyL4kwW7/G8qDBpy';

export interface AuthResult {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private drizzle: DrizzleService,
    private jwtService: JwtService,
    private readonly sessions: AuthSessionService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly pushSubscriptions: PushSubscriptionsService,
    private readonly recovery: AuthRecoveryService,
  ) {}

  async register(data: RegisterDto, userAgent?: string): Promise<AuthResult> {
    const db = this.drizzle.db;
    const username = this.normalizeUsername(data.username);
    const email = normalizeEmail(data.email);
    assertPasswordFitsBcrypt(data.password);

    const [existing] = await db
      .select({ username: users.username, email: users.email })
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))
      .limit(1);

    if (existing) {
      throw new ConflictException(
        existing.username === username
          ? 'Tên đăng nhập đã tồn tại!'
          : 'Email đã được sử dụng!',
      );
    }

    const hashedPassword = await this.passwordHasher.hash(data.password);
    let userId: number;
    try {
      userId = await db.transaction(async (tx) => {
        const [newUser] = await tx.insert(users).values({
          username,
          email,
          displayName: data.displayName?.trim() || null,
          password: hashedPassword,
        });
        await Promise.all([
          tx.insert(userProfiles).values({ userId: newUser.insertId }),
          tx.insert(userSettings).values({ userId: newUser.insertId }),
        ]);
        return newUser.insertId;
      });
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException('Tên đăng nhập hoặc email đã tồn tại!');
      }
      throw error;
    }

    try {
      await this.recovery.requestEmailVerification(userId);
    } catch (error) {
      this.logger.error(
        `Could not send registration verification email: ${
          error instanceof Error ? error.name : 'UnknownError'
        }`,
      );
    }

    return this.createAuthenticatedSession(userId, userAgent);
  }

  async login(loginDto: LoginDto, userAgent?: string): Promise<AuthResult> {
    const { password } = loginDto;
    const identifier = loginDto.identifier ?? loginDto.username;
    if (!identifier) {
      throw new BadRequestException('Email hoặc username không được để trống.');
    }
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const passwordWithinLimit =
      Buffer.byteLength(password, 'utf8') <= BCRYPT_MAX_PASSWORD_BYTES;

    const [user] = await this.drizzle.db
      .select({
        id: users.id,
        password: users.password,
      })
      .from(users)
      .where(
        or(
          eq(users.username, normalizedIdentifier),
          eq(users.email, normalizedIdentifier),
        ),
      )
      .limit(1);

    const passwordMatches =
      passwordWithinLimit &&
      (await this.passwordHasher.verify(
        password,
        user?.password ?? DUMMY_PASSWORD_HASH,
      ));
    if (!user || !passwordMatches) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác!',
      );
    }

    return this.createAuthenticatedSession(user.id, userAgent);
  }

  async logout(refreshToken: string | null) {
    const sessionId = await this.sessions.revokeSerialized(refreshToken);
    if (sessionId) {
      await this.pushSubscriptions.revokeForSession(sessionId);
    }
  }

  async logoutAll(userId: number) {
    await Promise.all([
      this.sessions.revokeAllForUser(userId),
      this.pushSubscriptions.revokeAllForUser(userId),
    ]);
  }

  async refreshTokens(refreshToken: string | null): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Phiên đăng nhập không tồn tại.');
    }
    const rotated = await this.sessions.rotate(refreshToken);
    return {
      accessToken: await this.issueAccessToken(
        rotated.userId,
        rotated.sessionId,
      ),
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: rotated.refreshToken,
    };
  }

  private async createAuthenticatedSession(
    userId: number,
    userAgent?: string,
  ): Promise<AuthResult> {
    const session = await this.sessions.create(userId, userAgent);
    const accessToken = await this.issueAccessToken(userId, session.id);
    return {
      accessToken,
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: session.refreshToken,
    };
  }

  private issueAccessToken(userId: number, sessionId: string) {
    return this.jwtService.signAsync({ userId, sid: sessionId });
  }

  private normalizeUsername(username: string) {
    return username.trim().toLowerCase();
  }

  private isDuplicateEntryError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { code?: unknown; cause?: { code?: unknown } };
    return (
      candidate.code === 'ER_DUP_ENTRY' ||
      candidate.cause?.code === 'ER_DUP_ENTRY'
    );
  }
}
