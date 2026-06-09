import { RequestHandler } from 'express';
import { z } from 'zod';

// Middleware factory that validates a request's body or query against a Zod schema and stashes the
// parsed (coerced) result back on the request. `schema.parse` throws synchronously on a bad payload;
// Express forwards that throw to the central error handler, which maps a ZodError to 400.
export function validate(schema: z.ZodType, source: 'body' | 'query' = 'body'): RequestHandler {
    return (request, _response, next) => {
        const parsed = schema.parse(source === 'body' ? request.body : request.query);

        if (source === 'body') request.body = parsed;
        else request.query = parsed as typeof request.query;

        next();
    };
}
