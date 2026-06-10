import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { AuthenticatedSocket } from '../interfaces/request-with-user.interface';
import {
  ACCESS_TOKEN_ALGORITHM,
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
} from '../../auth/auth.constants';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient<Socket>();

      const token = this.extractToken(client);

      if (!token) {
        throw new WsException('Token không tồn tại!');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        algorithms: [ACCESS_TOKEN_ALGORITHM],
        audience: ACCESS_TOKEN_AUDIENCE,
        issuer: ACCESS_TOKEN_ISSUER,
      });
      const identity = (client as AuthenticatedSocket).user;
      if (
        !identity
        || identity.userId !== payload.userId
        || identity.sessionId !== payload.sid
      ) {
        throw new WsException('Không tìm thấy định danh socket.');
      }

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WebSocket authentication failed: ${message}`);
      throw new WsException('Phiên đăng nhập không hợp lệ.');
    }
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const token = auth?.token;
    if (typeof token === 'string') return token;

    const header = client.handshake.headers?.authorization;
    if (header && header.startsWith('Bearer ')) {
      return header.split(' ')[1];
    }

    return undefined;
  }
}
