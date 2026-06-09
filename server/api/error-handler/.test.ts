import { describe, expect, test } from 'bun:test';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { errorHandler } from '.';

function stubs() {
    const statuses: number[] = [];
    const logged: unknown[] = [];
    // `response` exposes only sendStatus — a `.send`/`.json` call would throw, so a passing test
    // proves the handler never serializes the error to the client.
    const response = {
        sendStatus: (code: number) => {
            statuses.push(code);
            return response;
        },
    } as unknown as Response;
    const request = {
        log: {
            error: (context: unknown) => {
                logged.push(context);
            },
        },
    } as unknown as Request;
    const next = (() => {
        /* unused */
    }) as unknown as NextFunction;
    return { request, response, next, statuses, logged };
}

describe('errorHandler', () => {
    test('responds 500 for a generic error and logs it rather than leaking it', () => {
        const { request, response, next, statuses, logged } = stubs();

        errorHandler(new Error('secret connection string'), request, response, next);

        expect(statuses).toEqual([500]);
        expect(logged.length).toBe(1);
    });

    test('maps a ZodError to 400', () => {
        const { request, response, next, statuses } = stubs();
        // A real ZodError — the exact type the `validate` middleware throws on a bad payload.
        const result = z.object({ name: z.string() }).safeParse({ name: 123 });
        if (result.success) throw new Error('expected the schema to reject the payload');

        errorHandler(result.error, request, response, next);

        expect(statuses).toEqual([400]);
    });

    test('responds 500 for a non-Error thrown value', () => {
        const { request, response, next, statuses } = stubs();

        errorHandler('a bare string', request, response, next);

        expect(statuses).toEqual([500]);
    });
});
