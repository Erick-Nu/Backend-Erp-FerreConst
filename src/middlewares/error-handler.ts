import type { ErrorRequestHandler, RequestHandler } from 'express';

type ErrorWithStatus = Error & {
  statusCode: number;
};

const isErrorWithStatus = (error: unknown): error is ErrorWithStatus => {
  return error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number';
};

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const statusCode = isErrorWithStatus(error) ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Internal server error';

  res.status(statusCode).json({
    message,
  });
};
