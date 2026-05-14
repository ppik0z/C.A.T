import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Query,
    UseGuards,
    Request,
    ParseIntPipe
} from '@nestjs/common';
import { FriendshipsService } from './friendships.service';
import { AuthGuard } from '@nestjs/passport';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

type RequestListType = 'incoming' | 'outgoing';

@UseGuards(AuthGuard('jwt'))
@Controller('friends')
export class FriendshipsController {
    constructor(private readonly friendshipsService: FriendshipsService) { }

    // 1. Tìm kiếm người dùng
    @Get('search')
    async search(@Query('q') query: string, @Request() req: RequestWithUser) {
        return this.friendshipsService.searchUsers(query, req.user.userId);
    }

    // 2. Gợi ý bạn bè
    @Get('suggestions')
    async suggestions(@Request() req: RequestWithUser) {
        return this.friendshipsService.getSuggestions(req.user.userId);
    }

    // 3. Lấy danh sách bạn bè đã kết bạn
    @Get()
    async getMyFriends(@Request() req: RequestWithUser) {
        return this.friendshipsService.getMyFriends(req.user.userId);
    }

    // 4. Lấy danh sách lời mời kết bạn
    @Get('requests')
    async getPending(@Query('type') type: RequestListType = 'incoming', @Request() req: RequestWithUser) {
        return this.friendshipsService.getPendingRequests(req.user.userId, type);
    }

    // 5. Gửi lời mời kết bạn
    @Post('requests/:userId')
    async send(@Param('userId', ParseIntPipe) receiverId: number, @Request() req: RequestWithUser) {
        return this.friendshipsService.sendRequest(req.user.userId, receiverId);
    }

    // 6. Hủy lời mời đã gửi
    @Delete('requests/:userId')
    async cancel(@Param('userId', ParseIntPipe) receiverId: number, @Request() req: RequestWithUser) {
        return this.friendshipsService.cancelRequest(req.user.userId, receiverId);
    }

    // 7. Đồng ý lời mời kết bạn
    @Post('requests/:userId/accept')
    async accept(@Param('userId', ParseIntPipe) requesterId: number, @Request() req: RequestWithUser) {
        return this.friendshipsService.acceptRequest(req.user.userId, requesterId);
    }

    // 8. Từ chối lời mời kết bạn
    @Delete('requests/:userId/reject')
    async reject(@Param('userId', ParseIntPipe) requesterId: number, @Request() req: RequestWithUser) {
        return this.friendshipsService.rejectRequest(req.user.userId, requesterId);
    }

    // 9. Hủy kết bạn
    @Delete(':userId')
    async remove(@Param('userId', ParseIntPipe) targetId: number, @Request() req: RequestWithUser) {
        return this.friendshipsService.removeFriendship(req.user.userId, targetId);
    }

    // Legacy aliases kept while the frontend is migrating.
    @Get('me')
    async getMyFriendsLegacy(@Request() req: RequestWithUser) {
        return this.friendshipsService.getMyFriends(req.user.userId);
    }

    @Post('request/:id')
    async sendLegacy(@Param('id', ParseIntPipe) receiverId: number, @Request() req: RequestWithUser) {
        return this.friendshipsService.sendRequest(req.user.userId, receiverId);
    }

    @Post('accept/:id')
    async acceptLegacy(@Param('id', ParseIntPipe) requesterId: number, @Request() req: RequestWithUser) {
        return this.friendshipsService.acceptRequest(req.user.userId, requesterId);
    }

    @Delete('remove/:id')
    async removeLegacy(@Param('id', ParseIntPipe) targetId: number, @Request() req: RequestWithUser) {
        return this.friendshipsService.removeFriendship(req.user.userId, targetId);
    }
}
