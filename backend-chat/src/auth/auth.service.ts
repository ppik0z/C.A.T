import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto/create-auth.dto';
import { JwtService } from '@nestjs/jwt';

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

    // 1. Tìm user 
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    // 2. Nếu không thấy user hoặc mật khẩu không khớp
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác!');
    }

    // 3. Ký Token
    const payload = { sub: user.id, username: user.username };

    // 4. Trả về token và thông tin cơ bản
    const { password: _, refreshToken, ...userFull } = user;

    return {
      message: 'Đăng nhập thành công!',
      access_token: await this.jwtService.signAsync(payload),
      user: userFull,
    };
  }
}