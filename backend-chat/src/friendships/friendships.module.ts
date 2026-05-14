import { Module } from '@nestjs/common';
import { FriendshipsController } from './friendships.controller';
import { FriendshipsService } from './friendships.service';
import { FriendsGateway } from './friends.gateway';

@Module({
  controllers: [FriendshipsController],
  providers: [FriendshipsService, FriendsGateway],
  exports: [FriendshipsService]
})
export class FriendshipsModule { }
