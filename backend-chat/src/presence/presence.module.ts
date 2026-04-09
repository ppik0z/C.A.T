import { Module, Global } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { RedisModule } from '@liaoliaots/nestjs-redis';

@Global()
@Module({
  imports: [RedisModule],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule { }