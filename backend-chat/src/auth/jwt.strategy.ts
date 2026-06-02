import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JwtPayload } from 'src/common/index';
import { DrizzleService } from '../database/drizzle.service';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly drizzle: DrizzleService) {
        super({
            // Lấy Token từ Header
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            // Kiểm tra hsd
            ignoreExpiration: false,
            // Xác thực chữ ký
            secretOrKey: process.env.JWT_SECRET!,
        });
    }

    async validate(payload: JwtPayload) {
        const [user] = await this.drizzle.db
            .select({
                userId: users.id,
                username: users.username,
                displayName: users.displayName,
            })
            .from(users)
            .where(eq(users.id, payload.userId))
            .limit(1);

        return user ? { ...user, sessionId: payload.sid } : null;
    }
}
