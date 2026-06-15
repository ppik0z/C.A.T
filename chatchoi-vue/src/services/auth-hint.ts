const COOKIE_NAME = 'has_session';
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60; // 400 days (max allowed by browsers)

export const hasSessionHint = (): boolean =>
  document.cookie.split('; ').some((c) => c === `${COOKIE_NAME}=1`);

export const setSessionHint = () => {
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
};

export const clearSessionHint = () => {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
};
