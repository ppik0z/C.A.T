import { Module } from '@nestjs/common';
import { FcmPushProvider } from './fcm-push.provider';
import { PushNotificationListener } from './push-notification.listener';
import { PushNotificationsController } from './push-notifications.controller';
import { PushSubscriptionsService } from './push-subscriptions.service';

@Module({
  controllers: [PushNotificationsController],
  providers: [FcmPushProvider, PushNotificationListener, PushSubscriptionsService],
  exports: [PushSubscriptionsService],
})
export class PushNotificationsModule {}
