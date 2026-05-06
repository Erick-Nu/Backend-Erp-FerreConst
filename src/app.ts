import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { healthRouter } from './routes/health.routes.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'esnt-backend-ferreteria',
    version: '1.0.0',
  });
});

app.use('/api/health', healthRouter);

app.use(notFoundHandler);
app.use(errorHandler);
