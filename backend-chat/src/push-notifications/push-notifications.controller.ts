import { Body, Controller, Delete, Headers, Param, Post, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { RequestWithUser } from '../common';
import { RegisterFcmSubscriptionDto } from './dto/push-subscription.dto';
import { PushSubscriptionsService } from './push-subscriptions.service';

@Controller('push/subscriptions')
@UseGuards(AuthGuard('jwt'))
export class PushNotificationsController {
  constructor(private readonly subscriptions: PushSubscriptionsService) {}

  @Post()
  register(
    @Request() request: RequestWithUser,
    @Headers('user-agent') userAgent: string | undefined,
    @Body() body: RegisterFcmSubscriptionDto,
  ) {
    return this.subscriptions.registerFcm(request.user.userId, this.getSessionId(request), body, userAgent);
  }

  @Delete(':installationId')
  revoke(@Request() request: RequestWithUser, @Param('installationId') installationId: string) {
    return this.subscriptions.revokeInstallation(request.user.userId, this.getSessionId(request), installationId);
  }

  private getSessionId(request: RequestWithUser) {
    if (!request.user.sessionId) {
      throw new UnauthorizedException('Vui lòng làm mới phiên đăng nhập trước khi bật thông báo.');
    }

    return request.user.sessionId;
  }
}
