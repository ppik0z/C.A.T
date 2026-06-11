import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsGateway } from './calls.gateway';
import { CallMediaLifecycleListener } from './call-media-lifecycle.listener';
import { CALL_MEDIA_PROVIDER } from './call-media.types';
import { CallMediaTokenService } from './call-media-token.service';
import { CallLockService } from './call-lock.service';
import { CallsService } from './calls.service';
import { LiveKitCallMediaProvider } from './livekit-call-media.provider';
import { MessagesModule } from '../messages/messages.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        MessagesModule,
        AuthModule,
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
