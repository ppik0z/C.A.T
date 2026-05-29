import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './database/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { FriendshipsModule } from './friendships/friendships.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { ChatModule } from './chat/chat.module';

import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { Redis } from 'ioredis';
import { APP_GUARD } from '@nestjs/core';
import { HybridThrottlerGuard } from './common/guards/hybrid-throttler.guard';
import { PresenceModule } from './presence/presence.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';

import { ScheduleModule } from '@nestjs/schedule';
import { ReadStateModule } from './read-state/read-state.module';
import { CallsModule } from './calls/calls.module';

import { EventEmitterModule } from '@nestjs/event-emitter';
import { AccountModule } from './account/account.module';

@Module({
  imports: [DrizzleModule, AuthModule, FriendshipsModule, ConversationsModule, MessagesModule, ChatModule, ScheduleModule.forRoot(),
    ReadStateModule, CallsModule, EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 10000, // 10 giây
          limit: 30,   // Tối đa 30 requests 
        },
      ],
      storage: new ThrottlerStorageRedisService(
        new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      ),
    }),
    RedisModule.forRoot({
      config: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    }),
    PresenceModule,
    AccountModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: HybridThrottlerGuard,
    },
  ],
})
export class AppModule { }
