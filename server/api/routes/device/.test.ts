import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import express, { Express } from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import type { AddressInfo } from 'net';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { errorHandler } from '@api/error-handler';

import deviceRouter from '.';

let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let DeviceService: typeof import('@lib/data/device');
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

function buildApp(): Express {
    const app = express();
    app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
    app.use(express.json());
    app.use('/', deviceRouter);
    app.use(errorHandler);
    return app;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
    const server = buildApp().listen(0);
    const { port } = server.address() as AddressInfo;
    try {
        return await fetch(`http://127.0.0.1:${port}${path}`, init);
    } finally {
        server.close();
    }
}

const postJson = (body: unknown): Promise<Response> =>
    request('/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    DeviceService = await import('@lib/data/device');
    ({ closeDatabase } = await import('@lib/data/base'));
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

describe('device router', () => {
    test('POST /device registers the token', async () => {
        const response = await postJson({ token: 'expo-token-xyz' });

        expect(response.status).toBe(200);
        const tokens = (await DeviceService.list()).map(device => device.token);
        expect(tokens).toContain('expo-token-xyz');
    });

    test('POST /device without a token is rejected with 400', async () => {
        expect((await postJson({})).status).toBe(400);
    });
});
