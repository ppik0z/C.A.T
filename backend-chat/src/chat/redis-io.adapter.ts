import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { JwtService } from '@nestjs/jwt';

export class AuthIoAdapter extends IoAdapter {
    constructor(private app: any) {
        super(app);
    }

    private adapterConstructor: ReturnType<typeof createAdapter>;

    createIOServer(port: number, options?: any): any {
        const server = super.createIOServer(port, options);
        const jwtService = this.app.get(JwtService);

        server.use(async (socket, next) => {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

            if (!token) return next(new Error('Unauthorized'));

            try {
                const payload = await jwtService.verifyAsync(token);
                socket.user = { userId: payload.userId, username: payload.username };
                next();
            } catch {
                next(new Error('Token lỏ!'));
            }
        });

        return server;
    }
}