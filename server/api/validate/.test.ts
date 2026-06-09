import { describe, expect, test } from 'bun:test';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { validate } from '.';

const bodySchema = z.object({ amount: z.number() });
const querySchema = z.object({ name: z.string() });

describe('validate', () => {
    test('stashes the parsed body and calls next on success', () => {
        const request = { body: { amount: 5 } } as Request;
        let nextErr: unknown = 'untouched';

        validate(bodySchema)(
            request,
            {} as Response,
            ((err?: unknown) => {
                nextErr = err;
            }) as NextFunction,
        );

        expect(nextErr).toBeUndefined();
        expect(request.body).toEqual({ amount: 5 });
    });

    test('stashes the parsed query when source is query', () => {
        const request = { query: { name: 'food' } } as unknown as Request;

        validate(querySchema, 'query')(
            request,
            {} as Response,
            (() => {
                /* noop */
            }) as NextFunction,
        );

        expect(request.query).toEqual({ name: 'food' });
    });

    test('throws a ZodError on invalid input so Express forwards it', () => {
        const request = { body: {} } as Request;
        let thrown: unknown;

        try {
            validate(bodySchema)(
                request,
                {} as Response,
                (() => {
                    /* noop */
                }) as NextFunction,
            );
        } catch (error) {
            thrown = error;
        }

        expect((thrown as Error).name).toBe('ZodError');
    });
});
