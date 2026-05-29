import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CallsController } from './calls.controller';
import { CallsGateway } from './calls.gateway';
import { CallMediaLifecycleListener } from './call-media-lifecycle.listener';
import { CALL_MEDIA_PROVIDER } from './call-media.types';
import { CallMediaTokenService } from './call-media-token.service';
import { CallLockService } from './call-lock.service';
import { CallsService } from './calls.service';
import { LiveKitCallMediaProvider } from './livekit-call-media.provider';
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
    providers: [
        CallsGateway,
        CallsService,
        CallLockService,
        CallMediaTokenService,
        CallMediaLifecycleListener,
        {
            provide: CALL_MEDIA_PROVIDER,
            useClass: LiveKitCallMediaProvider,
        },
    ],
    exports: [CallsService],
})
export class CallsModule { }
