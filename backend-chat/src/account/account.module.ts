import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { DrizzleModule } from '../database/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
