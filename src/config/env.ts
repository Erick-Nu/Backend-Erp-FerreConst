import 'dotenv/config';

const DEFAULT_PORT = 3000;

const parsePort = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parsePort(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};
