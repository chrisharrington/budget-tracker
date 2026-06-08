import { RequestHandler } from 'express';

// Express 4 does not catch rejected promises from async route handlers, so an unhandled rejection
// would hang the request instead of reaching the error middleware. Wrapping a handler routes any
// thrown/rejected error to `next`, where the central error handler takes over.
export const asyncHandler = (handler: RequestHandler): RequestHandler =>
    (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
