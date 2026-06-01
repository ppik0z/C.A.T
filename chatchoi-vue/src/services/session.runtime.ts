let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;
let unauthorizedHandler: (() => void) | null = null;

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

export const handleUnauthorized = () => {
  unauthorizedHandler?.();
};
