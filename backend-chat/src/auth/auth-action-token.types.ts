export const AUTH_ACTION_PURPOSE = {
  VERIFY_EMAIL: 'verify_email',
  RESET_PASSWORD: 'reset_password',
} as const;

export type AuthActionPurpose =
  (typeof AUTH_ACTION_PURPOSE)[keyof typeof AUTH_ACTION_PURPOSE];

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
