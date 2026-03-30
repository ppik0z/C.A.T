import { ConflictException, Injectable } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/create-auth.dto';

@Injectable()
export class AuthService {
  constructor(private drizzle: DrizzleService) {}

  async register(data: RegisterDto) {
    const db = this.drizzle.db;

    // 1. Kiểm tra xem username đã tồn tại chưa
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    if (existing) {
      throw new ConflictException('Tên đăng nhập đã tồn tại!');
    }

    // 2. Băm mật khẩu
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 3. Lưu vào Database
    await db.insert(users).values({
      username: data.username,
      password: hashedPassword,
      avatar: data.avatar ?? null,
    });

    // 4. Lấy lại user vừa tạo để trả về
    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    // 5. Bỏ password ra khỏi response
    const { password, ...result } = newUser;
    return {
      message: 'Đăng ký thành công!',
      user: result,
    };
  }
}