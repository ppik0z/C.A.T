import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

export class AuthIoAdapter extends IoAdapter {
    private readonly logger = new Logger(AuthIoAdapter.name);
    private adapterConstructor: ReturnType<typeof createAdapter>;

    constructor(private app: any) {
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

    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options);
        const jwtService = this.app.get(JwtService);

        // Gắn Adapter để scale-out
        server.adapter(this.adapterConstructor);

        // Middleware xác thực Token cho Socket
        server.use(async (socket: any, next) => {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

            if (!token) return next(new Error('Unauthorized - Thiếu Token!'));

            try {
                const payload = await jwtService.verifyAsync(token);
                socket.user = { userId: payload.userId, username: payload.username };
                next();
            } catch {
                next(new Error('Unauthorized - Token lỏ!'));
            }
        });

        return server;
    }
}