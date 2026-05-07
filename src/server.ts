import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

const server = app.listen(env.port, () => {
  logger.info({ port: env.port }, 'Server running');
});

const handleServerStartError = (error: Error): void => {
  logger.error({ err: error }, 'Error starting server');
  process.exit(EXIT_FAILURE);
};

const shutdown = (signal: NodeJS.Signals): void => {
  logger.info({ signal }, 'Shutting down server');

  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'Error during server shutdown');
      process.exit(EXIT_FAILURE);
    }

    process.exit(EXIT_SUCCESS);
  });
};

server.on('error', handleServerStartError);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
