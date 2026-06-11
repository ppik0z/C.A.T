import { BadRequestException } from '@nestjs/common';

export const BCRYPT_MAX_PASSWORD_BYTES = 72;

export const assertPasswordFitsBcrypt = (password: string) => {
  if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES) {
    throw new BadRequestException('Mật khẩu tối đa 72 byte.');
  }
};
