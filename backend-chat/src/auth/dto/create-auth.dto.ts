import { IsString, MinLength, MaxLength, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class RegisterDto {
    @IsNotEmpty({ message: 'Tên đăng nhập không được để trống!' })
    @IsString({ message: 'Username phải là chuỗi ký tự' })
    @MinLength(4, { message: 'Username ít nhất phải 4 ký tự' })
    @MaxLength(20, { message: 'Username tối đa 20 ký tự' })
    username: string;

    @IsNotEmpty({ message: 'Mật khẩu là bắt buộc' })
    @MinLength(6, { message: 'Mật khẩu phải từ 6 ký tự trở lên' })
    password: string;

    @IsOptional()
    @IsUrl({}, { message: 'Link ảnh đại diện không hợp lệ' })
    avatar?: string;
}