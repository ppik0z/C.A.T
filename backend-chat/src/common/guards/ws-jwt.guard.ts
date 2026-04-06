import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

export interface AuthenticatedSocket extends Socket {
  user: JwtPayload;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();

      const token = this.extractToken(client);

      if (!token) {
        throw new WsException('Token không tồn tại!');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      (client as AuthenticatedSocket).user = {
        userId: payload.userId,
        username: payload.username,
      };

      return true;
    } catch (err) {
      this.logger.error(`Auth failed: ${err.message}`);
      throw new WsException('Token lỏ!');
    }
  }

  private extractToken(client: Socket): string | undefined {
    const { token } = client.handshake.auth as { token?: string };
    if (token) return token;

    const header = client.handshake.headers?.authorization;
    if (header && header.startsWith('Bearer ')) {
      return header.split(' ')[1];
    }

    const query = client.handshake.query?.token;
    if (typeof query === 'string') return query;

    return undefined;
  }
}