import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { DrizzleModule } from '../database/drizzle.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [DrizzleModule, ProfilesModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
