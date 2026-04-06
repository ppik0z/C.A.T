import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        MessagesModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: '7d' },
        }),
    ],
    providers: [ChatGateway],
    exports: [ChatGateway],
})
export class ChatModule { }