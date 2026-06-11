import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { PresenceModule } from 'src/presence/presence.module';
import { FriendshipsModule } from 'src/friendships/friendships.module';
import { ReadStateModule } from 'src/read-state/read-state.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        MessagesModule,
        PresenceModule,
        FriendshipsModule,
        ReadStateModule,
        ConversationsModule,
        AuthModule,
    ],
    providers: [ChatGateway],
    exports: [ChatGateway],
})
export class ChatModule { }
