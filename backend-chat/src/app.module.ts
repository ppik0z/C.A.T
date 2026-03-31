import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './database/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { FriendshipsModule } from './friendships/friendships.module';

@Module({
  imports: [DrizzleModule, AuthModule, FriendshipsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
