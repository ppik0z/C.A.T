import { Controller, Get, Param, ParseIntPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CallsService } from './calls.service';
import { CallMediaTokenService } from './call-media-token.service';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@UseGuards(AuthGuard('jwt'))
@Controller('calls')
export class CallsController {
    constructor(
        private readonly callsService: CallsService,
        private readonly callMediaTokenService: CallMediaTokenService,
    ) { }

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

    @Post(':callId/media-token')
    async createMediaToken(
        @Param('callId', ParseIntPipe) callId: number,
        @Request() req: RequestWithUser,
    ) {
        return this.callMediaTokenService.createToken(req.user.userId, callId);
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
