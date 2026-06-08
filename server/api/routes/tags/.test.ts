import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import express, { Express } from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import type { AddressInfo } from 'net';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { Tag } from '@lib/models';
import { errorHandler } from '@api/error-handler';

import tagsRouter from '.';

let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let collection: typeof import('@lib/data/base').collection;
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

function buildApp(): Express {
    const app = express();
    app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
    app.use(express.json());
    app.use('/', tagsRouter);
    app.use(errorHandler);
    return app;
}

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    ({ collection, closeDatabase } = await import('@lib/data/base'));

    await (await collection<Tag>('tags')).insertMany([
        { name: 'bravo', ignore: false },
        { name: 'alpha', ignore: false }
    ] as Tag[]);
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

describe('tags router', () => {
    test('GET /tags/recent returns the recent tags sorted by name', async () => {
        const server = buildApp().listen(0);
        const { port } = server.address() as AddressInfo;

        try {
            const response = await fetch(`http://127.0.0.1:${port}/tags/recent`);
            const body = await response.json() as Tag[];

            expect(response.status).toBe(200);
            expect(body.map(tag => tag.name)).toEqual(['alpha', 'bravo']);
        } finally {
            server.close();
        }
    });
});
