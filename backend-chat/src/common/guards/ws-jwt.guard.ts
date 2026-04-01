import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();

      const authHeader = client.handshake.headers?.authorization;
      const authToken = client.handshake.auth?.token as string | undefined;

      const token = authToken || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined);

      if (!token) {
        throw new WsException('Token không tồn tại!');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      (client as any).user = payload;

      return true;
    } catch (err) {
      throw new WsException('Token lỏ, login lại!');
    }
  }
}