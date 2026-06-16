import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { RequestWithUser } from '../common';
import { ListNotificationsQueryDto, MarkReadDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Request() request: RequestWithUser, @Query() query: ListNotificationsQueryDto) {
    return this.notifications.listForUser(request.user.userId, {
      limit: query.limit,
      beforeId: query.beforeId,
    });
  }

  @Get('unread-count')
  async unreadCount(@Request() request: RequestWithUser) {
    return { unreadCount: await this.notifications.getUnreadCount(request.user.userId) };
  }

  @Post('read')
  markRead(@Request() request: RequestWithUser, @Body() body: MarkReadDto) {
    if (body.all) {
      return this.notifications.markAllRead(request.user.userId);
    }
    return this.notifications.markRead(request.user.userId, body.ids ?? []);
  }

  @Delete(':id')
  remove(@Request() request: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.remove(request.user.userId, id);
  }
}
