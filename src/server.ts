import { createServer } from 'node:http';

import { app } from './app.js';
import { env } from './config/env.js';

const server = createServer(app);

server.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`${signal} received, shutting down server`);

  server.close((error) => {
    if (error) {
      console.error('Error during server shutdown', error);
      process.exit(1);
    }

    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
