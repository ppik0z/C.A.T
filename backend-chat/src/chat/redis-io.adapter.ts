import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { JwtService } from '@nestjs/jwt';
import { INestApplicationContext, Logger } from '@nestjs/common';
import type { JwtPayload, AuthenticatedSocket } from '../common';
import { AuthIdentityService } from '../auth/auth-identity.service';
import {
    ACCESS_TOKEN_ALGORITHM,
    ACCESS_TOKEN_AUDIENCE,
    ACCESS_TOKEN_ISSUER,
} from '../auth/auth.constants';
import { resolveCorsOrigin } from '../auth/auth-origin.policy';

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
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: resolveCorsOrigin,
                credentials: true,
            },
        }) as unknown as Server;
        const jwtService = this.app.get<JwtService>(JwtService);
        const identities = this.app.get<AuthIdentityService>(AuthIdentityService);

        // Gắn Adapter để scale-out
        server.adapter(this.adapterConstructor);

        // Middleware xác thực Token cho Socket
        server.use((socket: Socket, next: (err?: Error) => void) => {
            const token = this.extractToken(socket);

            if (!token) {
                next(new Error('Unauthorized - Thiếu Token!'));
                return;
            }

            jwtService.verifyAsync<JwtPayload>(token, {
                algorithms: [ACCESS_TOKEN_ALGORITHM],
                audience: ACCESS_TOKEN_AUDIENCE,
                issuer: ACCESS_TOKEN_ISSUER,
            })
                .then(async (payload) => {
                    const identity = await identities.resolve(payload);
                    if (!identity) throw new Error('Session not found');
                    (socket as AuthenticatedSocket).user = identity;
                    this.disconnectWhenTokenExpires(socket, payload);
                    next();
                })
                .catch(() => {
                    next(new Error('Unauthorized - Phiên đăng nhập không hợp lệ.'));
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

    private disconnectWhenTokenExpires(socket: Socket, payload: JwtPayload) {
        if (!payload.exp) {
            socket.disconnect(true);
            return;
        }

        const remainingLifetimeMs = Math.max(0, payload.exp * 1000 - Date.now());
        const expiryTimer = setTimeout(() => socket.disconnect(true), remainingLifetimeMs);
        socket.once('disconnect', () => clearTimeout(expiryTimer));
    }
}
