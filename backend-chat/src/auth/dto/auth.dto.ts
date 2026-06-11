import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._]{4,20}$/, {
    message:
      'Username chỉ gồm chữ, số, dấu chấm hoặc gạch dưới và dài từ 4 đến 20 ký tự.',
  })
  username!: string;

  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự.' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(255)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'Token không hợp lệ.' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự.' })
  newPassword!: string;
}

export class VerifyEmailDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'Token không hợp lệ.' })
  token!: string;
}
