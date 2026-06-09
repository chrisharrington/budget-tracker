import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

// The single error-handling middleware for the API. Registered last in the chain, it receives any
// error thrown by a route handler (forwarded via asyncHandler). It logs through `req.log` so the
// pino-http correlation id is preserved, then responds with a bare status code — the error is never
// serialized to the client. A ZodError (from request validation in `validate`) maps to 400;
// everything else is 500.
export function errorHandler(err: unknown, request: Request, response: Response, _next: NextFunction): void {
    request.log.error({ err }, 'Unhandled request error');

    if (err instanceof z.ZodError) {
        response.sendStatus(400);
        return;
    }

    response.sendStatus(500);
}
