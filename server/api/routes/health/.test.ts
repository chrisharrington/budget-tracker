import { describe, expect, test } from 'bun:test';
import express, { Express } from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import type { AddressInfo } from 'net';

import healthRouter from '.';

function buildApp(): Express {
    const app = express();
    app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
    app.use('/', healthRouter);
    return app;
}

describe('health router', () => {
    test('GET /health returns 200 with an ok status and no Mongo round-trip', async () => {
        const server = buildApp().listen(0);
        const { port } = server.address() as AddressInfo;

        try {
            const response = await fetch(`http://127.0.0.1:${port}/health`);
            const body = (await response.json()) as { status: string };

            expect(response.status).toBe(200);
            expect(body.status).toBe('ok');
        } finally {
            server.close();
        }
    });
});
