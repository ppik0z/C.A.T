import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MediaUploadService } from './media-upload.service';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [ProfilesModule],
  controllers: [MessagesController],
  providers: [MessagesService, MediaUploadService],
  exports: [MessagesService],
})
export class MessagesModule { }
