import { Controller, Get, Param, ParseIntPipe, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CallsService } from './calls.service';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@UseGuards(AuthGuard('jwt'))
@Controller('calls')
export class CallsController {
    constructor(private readonly callsService: CallsService) { }

    @Get('active')
    async getActiveCalls(@Request() req: RequestWithUser) {
        return this.callsService.getActiveCallsForUser(req.user.userId);
    }

    @Get('conversations/:conversationId/active')
    async getActiveCallForConversation(
        @Param('conversationId', ParseIntPipe) conversationId: number,
        @Request() req: RequestWithUser,
    ) {
        return this.callsService.getActiveCallForConversation(req.user.userId, conversationId);
    }

    @Get('history')
    async getCallHistory(
        @Request() req: RequestWithUser,
        @Query('conversationId') conversationId?: string,
        @Query('limit') limit?: string,
        @Query('beforeId') beforeId?: string,
    ) {
        return this.callsService.getCallHistory(req.user.userId, {
            conversationId: conversationId ? Number(conversationId) : undefined,
            limit: limit ? Number(limit) : undefined,
            beforeId: beforeId ? Number(beforeId) : undefined,
        });
    }
}
