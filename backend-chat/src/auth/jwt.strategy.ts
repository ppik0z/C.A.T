import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JwtPayload } from 'src/common/index';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            // Lấy Token từ Header
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            // Kiểm tra hsd
            ignoreExpiration: false,
            // Xác thực chữ ký
            secretOrKey: process.env.JWT_SECRET!,
        });
    }

    validate(payload: JwtPayload) {
        return { userId: payload.userId, username: payload.username };
    }
}