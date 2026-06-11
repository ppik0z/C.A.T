import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JwtPayload } from 'src/common/index';
import { AuthIdentityService } from './auth-identity.service';
import {
    ACCESS_TOKEN_ALGORITHM,
    ACCESS_TOKEN_AUDIENCE,
    ACCESS_TOKEN_ISSUER,
} from './auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly identities: AuthIdentityService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET!,
            algorithms: [ACCESS_TOKEN_ALGORITHM],
            audience: ACCESS_TOKEN_AUDIENCE,
            issuer: ACCESS_TOKEN_ISSUER,
        });
    }

    async validate(payload: JwtPayload) {
        return this.identities.resolve(payload);
    }
}
