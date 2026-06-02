import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { DrizzleModule } from '../database/drizzle.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { AuthModule } from '../auth/auth.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
  imports: [DrizzleModule, ProfilesModule, AuthModule, PushNotificationsModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
