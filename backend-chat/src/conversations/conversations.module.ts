import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { GroupAvatarService } from './group-avatar.service';

@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService, GroupAvatarService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
