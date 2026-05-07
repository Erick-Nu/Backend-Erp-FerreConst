import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { healthRouter } from './routes/health.routes.js';
import { logger } from './utils/logger.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
  }),
);
app.use(express.json());
app.use(
  morgan('combined', {
    stream: {
      write: (message) => {
        logger.info(message.trim());
      },
    },
  }),
);

app.get('/', (req, res) => {
  res.status(200).json({
    name: 'esnt-backend-ferreteria',
    version: '1.0.0',
  });
});

app.use('/api/health', healthRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
