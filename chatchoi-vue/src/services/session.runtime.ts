let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;
let unauthorizedHandler: (() => void) | null = null;
const REFRESH_LOCK_NAME = 'chatchoi-session-refresh';

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const configureSessionRuntime = (input: {
  refresh: () => Promise<string | null>;
  unauthorized: () => void;
}) => {
  refreshHandler = input.refresh;
  unauthorizedHandler = input.unauthorized;
};

export const refreshAccessToken = async () => {
  return refreshHandler ? refreshHandler() : null;
};

export const withRefreshLock = async <T>(task: () => Promise<T>): Promise<T> => {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return task();
  }

  return navigator.locks.request(REFRESH_LOCK_NAME, { mode: 'exclusive' }, task);
};

export const handleUnauthorized = () => {
  unauthorizedHandler?.();
};
