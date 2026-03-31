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


@UseGuards(AuthGuard('jwt'))
@Controller('friendships')
export class FriendshipsController {
    constructor(private readonly friendshipsService: FriendshipsService) { }

    // 1. Tìm kiếm người dùng 
    @Get('search')
    async search(@Query('q') query: string, @Request() req: RequestWithUser) {
        return this.friendshipsService.searchUsers(query, req.user.userId);
    }

    // 2. Lấy danh sách bạn bè đã kết bạn
    @Get('me')
    async getMyFriends(@Request() req: RequestWithUser) {
        return this.friendshipsService.getMyFriends(req.user.userId);
    }

    // 3. Lấy danh sách các lời mời kết bạn
    @Get('requests')
    async getPending(@Request() req: RequestWithUser) {
        return this.friendshipsService.getPendingRequests(req.user.userId);
    }

    // 4. Gửi lời mời kết bạn
    @Post('request/:id')
    async send(@Param('id', ParseIntPipe) receiverId: number, @Request() req: RequestWithUser) {
        return this.friendshipsService.sendRequest(req.user.userId, receiverId);
    }

    // 5. Đồng ý lời mời kết bạn
    @Post('accept/:id')
    async accept(@Param('id', ParseIntPipe) requesterId: number, @Request() req: RequestWithUser) {
        return this.friendshipsService.acceptRequest(req.user.userId, requesterId);
    }

    // 6. Hủy kết bạn hoặc từ chối/xóa lời mời kết bạn
    @Delete('remove/:id')
    async remove(@Param('id', ParseIntPipe) targetId: number, @Request() req: RequestWithUser) {
        return this.friendshipsService.removeFriendship(req.user.userId, targetId);
    }
}