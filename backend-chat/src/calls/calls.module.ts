import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CallsController } from './calls.controller';
import { CallsGateway } from './calls.gateway';
import { CallsService } from './calls.service';
import { MessagesModule } from '../messages/messages.module';

@Module({
    imports: [
        MessagesModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: '7d' },
        }),
    ],
    controllers: [CallsController],
    providers: [CallsGateway, CallsService],
    exports: [CallsService],
})
export class CallsModule { }
