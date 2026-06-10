import type { JwtModuleOptions } from '@nestjs/jwt';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const ACCESS_TOKEN_ISSUER = 'chatchoi-api';
export const ACCESS_TOKEN_AUDIENCE = 'chatchoi-web';
export const ACCESS_TOKEN_ALGORITHM = 'HS256' as const;

export const getJwtModuleOptions = (): JwtModuleOptions => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET phải có ít nhất 32 ký tự.');
  }

  return {
    secret,
    signOptions: {
      algorithm: ACCESS_TOKEN_ALGORITHM,
      audience: ACCESS_TOKEN_AUDIENCE,
      issuer: ACCESS_TOKEN_ISSUER,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    },
    verifyOptions: {
      algorithms: [ACCESS_TOKEN_ALGORITHM],
      audience: ACCESS_TOKEN_AUDIENCE,
      issuer: ACCESS_TOKEN_ISSUER,
    },
  };
};
