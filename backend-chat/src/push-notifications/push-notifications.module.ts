import { Module } from '@nestjs/common';
import { FcmPushProvider } from './fcm-push.provider';
import { PushNotificationListener } from './push-notification.listener';
import { PushNotificationsController } from './push-notifications.controller';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [ProfilesModule],
  controllers: [PushNotificationsController],
  providers: [FcmPushProvider, PushNotificationListener, PushSubscriptionsService],
  exports: [PushSubscriptionsService],
})
export class PushNotificationsModule {}
