import {
  Injectable,
  Inject,
  Logger,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { AuthenticatedUser } from '../interfaces/request-with-user.interface';
import type { Socket } from 'socket.io';

type ThrottledSocket = Socket & { user?: AuthenticatedUser };

@Injectable()
export class HybridThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(HybridThrottlerGuard.name);

  constructor(
    @Inject('THROTTLER:MODULE_OPTIONS') options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context, limit, ttl, blockDuration, throttler } = requestProps;

    if (context.getType() === 'ws') {
      const client = context.switchToWs().getClient<ThrottledSocket>();
      const userIdentifier = client.user?.userId
        ? `user_${client.user.userId}`
        : client.handshake.address;
      const throttlerName = throttler?.name || 'short';

      const resolvedLimit = await this.parseValue(context, limit);
      const resolvedTtl = await this.parseValue(context, ttl);

      const key = this.generateKey(context, userIdentifier, throttlerName);

      const { totalHits } = await this.storageService.increment(
        key,
        resolvedTtl,
        resolvedLimit,
        blockDuration,
        throttlerName,
      );

      if (totalHits > resolvedLimit) {
        this.logger.warn(
          `WebSocket rate limit exceeded tracker=${userIdentifier} hits=${totalHits}/${resolvedLimit}`,
        );
        throw new WsException(
          'Bạn đang thao tác quá nhanh. Vui lòng chậm lại.',
        );
      }
      return true;
    }

    return super.handleRequest(requestProps);
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
    }>();
    this.logger.warn(
      `HTTP rate limit exceeded method=${request.method ?? 'UNKNOWN'} path=${
        request.originalUrl ?? request.url ?? 'unknown'
      } tracker=${detail.tracker} hits=${detail.totalHits}/${detail.limit} retryAfter=${detail.timeToBlockExpire}s`,
    );
    await super.throwThrottlingException(context, detail);
  }

  private async parseValue(
    context: ExecutionContext,
    value: number | ((context: ExecutionContext) => number | Promise<number>),
  ): Promise<number> {
    return typeof value === 'function' ? await value(context) : value;
  }
}
