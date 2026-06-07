import { describe, expect, test } from 'bun:test';
import express from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import type { AddressInfo } from 'net';

import Budget from '.';

describe('BudgetRoute error handling', () => {
    test('responds 500 without leaking the internal error', async () => {
        const app = express();
        app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
        Budget.initialize(app);
        const server = app.listen(0);
        const { port } = server.address() as AddressInfo;

        try {
            // No `date` query param → the handler throws `Missing date parameter…` → catch →
            // sanitized 500. A DB-free, deterministic error path.
            const response = await fetch(`http://127.0.0.1:${port}/week`);
            const body = await response.text();

            expect(response.status).toBe(500);
            expect(body).toBe('Internal Server Error');
            expect(body).not.toContain('date parameter');
        } finally {
            server.close();
        }
    });
});
