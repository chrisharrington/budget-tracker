import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import express, { Express } from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import type { AddressInfo } from 'net';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { OneTime } from '@lib/models';
import { errorHandler } from '@api/error-handler';

import oneTimeRouter from '.';

let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let collection: typeof import('@lib/data/base').collection;
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

function buildApp(): Express {
    const app = express();
    app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
    app.use(express.json());
    app.use('/', oneTimeRouter);
    app.use(errorHandler);
    return app;
}

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    ({ collection, closeDatabase } = await import('@lib/data/base'));

    await (await collection<OneTime>('one-time')).insertOne({ balance: 1234 } as OneTime);
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

describe('one-time router', () => {
    test('GET /one-time/balance returns the stored balance', async () => {
        const server = buildApp().listen(0);
        const { port } = server.address() as AddressInfo;

        try {
            const response = await fetch(`http://127.0.0.1:${port}/one-time/balance`);
            const body = (await response.json()) as OneTime;

            expect(response.status).toBe(200);
            expect(body.balance).toBe(1234);
        } finally {
            server.close();
        }
    });
});
