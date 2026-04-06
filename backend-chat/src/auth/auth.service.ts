import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto/create-auth.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../common/index';

@Injectable()
export class AuthService {
  constructor(
    private drizzle: DrizzleService,
    private jwtService: JwtService,
  ) { }

  // --- HÀM REGISTER ---
  async register(data: RegisterDto) {
    const db = this.drizzle.db;

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    if (existing) {
      throw new ConflictException('Tên đăng nhập đã tồn tại!');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    await db.insert(users).values({
      username: data.username,
      password: hashedPassword,
      avatar: data.avatar ?? null,
    });

    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    const { password, ...result } = newUser;
    return {
      message: 'Đăng ký thành công!',
      user: result,
    };
  }

  // --- HÀM LOGIN ---
  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác!');
    }

    const tokens = await this.getTokens(user.id, user.username);

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Đăng nhập thành công!',
      ...tokens,
      user: { id: user.id, username: user.username },
    };
  }

  // --- HÀM LOGOUT ---
  async logout(userId: number) {
    await this.drizzle.db
      .update(users)
      .set({ refreshToken: null })
      .where(eq(users.id, userId));
    return { message: 'Đăng xuất thành công!' };
  }

  // --- HÀM GET TOKENS ---
  async getTokens(userId: number, username: string) {
    const [accessToken, refreshToken] = await Promise.all([
      // Access Token
      this.jwtService.signAsync(
        { userId, username },
        { secret: process.env.JWT_SECRET, expiresIn: '7d' },
      ),
      // Refresh Token
      this.jwtService.signAsync(
        { userId, username },
        { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '30d' },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  // --- HÀM UPDATE REFRESH TOKEN ---
  async updateRefreshToken(userId: number, refreshToken: string) {
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await this.drizzle.db
      .update(users)
      .set({ refreshToken: hashedToken })
      .where(eq(users.id, userId));
  }

  // --- HÀM REFRESH TOKEN ---
  async refreshTokens(refreshToken: string) {
    let payload: JwtPayload;

    // xác thực TOKEN
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch (e) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    // logic database
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã đăng xuất.');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã được sử dụng.');
    }

    const tokens = await this.getTokens(user.id, user.username);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }
}