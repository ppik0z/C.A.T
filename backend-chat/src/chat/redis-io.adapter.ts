import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { JwtService } from '@nestjs/jwt';
import { INestApplicationContext, Logger } from '@nestjs/common';
import type { JwtPayload, AuthenticatedSocket } from '../common';

export class AuthIoAdapter extends IoAdapter {
    private readonly logger = new Logger(AuthIoAdapter.name);
    private adapterConstructor: ReturnType<typeof createAdapter>;

    constructor(private app: INestApplicationContext) {
        super(app);
    }

    /**
     * Khởi tạo kết nối Redis Pub/Sub cho Socket.io
     */
    async connectToRedis(): Promise<void> {
        const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        const subClient = pubClient.duplicate();

        await Promise.all([pubClient.connect(), subClient.connect()]);

        this.adapterConstructor = createAdapter(pubClient, subClient);
        this.logger.log('Redis Socket Adapter đã sẵn sàng!');
    }

    createIOServer(port: number, options?: Partial<ServerOptions>): Server {
        const server = super.createIOServer(port, options) as unknown as Server;
        const jwtService = this.app.get<JwtService>(JwtService);

        // Gắn Adapter để scale-out
        server.adapter(this.adapterConstructor);

        // Middleware xác thực Token cho Socket
        server.use((socket: Socket, next: (err?: Error) => void) => {
            const token = this.extractToken(socket);

            if (!token) {
                next(new Error('Unauthorized - Thiếu Token!'));
                return;
            }

            jwtService.verifyAsync<JwtPayload>(token)
                .then((payload) => {
                    (socket as AuthenticatedSocket).user = {
                        userId: payload.userId,
                        username: payload.username,
                        displayName: payload.displayName ?? null,
                    };
                    next();
                })
                .catch(() => {
                    next(new Error('Unauthorized - Token lỏ!'));
                });
        });

        return server;
    }

    private extractToken(socket: Socket): string | undefined {
        const auth = socket.handshake.auth as Record<string, unknown> | undefined;
        const authToken = auth?.token;
        if (typeof authToken === 'string') return authToken;

        const authorization = socket.handshake.headers.authorization;
        if (authorization?.startsWith('Bearer ')) {
            return authorization.slice('Bearer '.length);
        }

        return undefined;
    }
}
