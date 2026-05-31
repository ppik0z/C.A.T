import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { AuthenticatedSocket } from '../interfaces/request-with-user.interface';

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

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      (client as AuthenticatedSocket).user = {
        userId: payload.userId,
        username: payload.username,
        displayName: payload.displayName ?? null,
      };

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Auth failed: ${message}`);
      throw new WsException('Token lỏ!');
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

    const query = client.handshake.query?.token;
    if (typeof query === 'string') return query;

    return undefined;
  }
}
