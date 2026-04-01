import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './database/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { FriendshipsModule } from './friendships/friendships.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [DrizzleModule, AuthModule, FriendshipsModule, ConversationsModule, MessagesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
