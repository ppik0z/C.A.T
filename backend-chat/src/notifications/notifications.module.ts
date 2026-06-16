import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsListener } from './notifications.listener';
import { NotificationsGateway } from './notifications.gateway';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [ProfilesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsListener, NotificationsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
