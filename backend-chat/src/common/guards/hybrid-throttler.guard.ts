// backend-chat/src/common/guards/hybrid-throttler.guard.ts
import { Injectable, Inject, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import {
    ThrottlerGuard,
    type ThrottlerRequest,
    type ThrottlerModuleOptions,
    type ThrottlerStorage
} from '@nestjs/throttler';

@Injectable()
export class HybridThrottlerGuard extends ThrottlerGuard {
    constructor(
        @Inject('THROTTLER:MODULE_OPTIONS') options: ThrottlerModuleOptions,
        storageService: ThrottlerStorage,
        reflector: Reflector,
    ) {
        super(options, storageService, reflector);
    }

    // HÀM HELPER ĐỂ GIẢI MÃ GIÁ TRỊ (Vì resolveValue bị private)
    private async parseValue(context: ExecutionContext, value: any): Promise<number> {
        return typeof value === 'function' ? await value(context) : value;
    }

    protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
        const { context, limit, ttl, blockDuration, throttler } = requestProps;

        if (context.getType() === 'ws') {
            const client = context.switchToWs().getClient();
            const userIdentifier = client.user?.userId ? `user_${client.user.userId}` : client.conn?.remoteAddress;
            const throttlerName = throttler?.name || 'short';

            const resolvedLimit = await this.parseValue(context, limit);
            const resolvedTtl = await this.parseValue(context, ttl);

            const key = this.generateKey(context, userIdentifier, throttlerName);

            const { totalHits, timeToBlockExpire } = await this.storageService.increment(
                key,
                resolvedTtl,
                resolvedLimit,
                blockDuration,
                throttlerName
            );

            if (totalHits > resolvedLimit) {
                console.warn(`[SPAM DETECTED] ${userIdentifier} hit ${totalHits}/${resolvedLimit} lần!`);
                throw new WsException('Chat nhanh quá, chậm lại tí!');
            }
            return true;
        }

        return super.handleRequest(requestProps);
    }
}