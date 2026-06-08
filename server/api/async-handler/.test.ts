import { describe, expect, test } from 'bun:test';
import type { NextFunction, Request, Response } from 'express';

import { asyncHandler } from '.';

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('asyncHandler', () => {
    test('forwards a rejected handler error to next', async () => {
        const boom = new Error('boom');
        const calls: unknown[] = [];
        const wrapped = asyncHandler(async () => { throw boom; });

        wrapped({} as Request, {} as Response, ((err?: unknown) => calls.push(err)) as NextFunction);
        await flush();

        expect(calls).toEqual([boom]);
    });

    test('does not invoke next when the handler resolves', async () => {
        const calls: unknown[] = [];
        const wrapped = asyncHandler(async () => { /* resolves cleanly */ });

        wrapped({} as Request, {} as Response, ((err?: unknown) => calls.push(err)) as NextFunction);
        await flush();

        expect(calls).toEqual([]);
    });
});
