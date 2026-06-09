import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

import Config from '@lib/config';

import { collection, closeDatabase } from '.';

// Integration coverage for the shared data-layer primitive: boot a real ephemeral mongod and drive
// reads/writes through the `collection<T>` helper (no mocking). The only boundary we swap is the
// connection string, which the shared pooled client reads from `Config` on first use.

interface Widget {
    _id: string;
    name: string;
    value: number;
}

let mongod!: MongoMemoryServer;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config.databaseConnectionString = mongod.getUri();
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

describe('collection', () => {
    test('returns a working collection on the shared pooled client', async () => {
        const widgets = await collection<Widget>('widgets');
        await widgets.insertOne({ name: 'alpha', value: 1 } as Widget);

        const found = await widgets.findOne({ name: 'alpha' });
        expect(found?.value).toBe(1);
    });

    test('reads and writes the database named by Config.mongoDb', async () => {
        const original = Config.mongoDb;
        Config.mongoDb = 'mongo_db_honored';

        try {
            const widgets = await collection<Widget>('widgets');
            await widgets.insertOne({ name: 'configured-db', value: 99 } as Widget);

            // Read directly from the configured database name; a hard-coded 'budget' would miss this.
            const client = await MongoClient.connect(mongod.getUri());
            try {
                const doc = await client
                    .db('mongo_db_honored')
                    .collection('widgets')
                    .findOne({ name: 'configured-db' });
                expect(doc?.value).toBe(99);
            } finally {
                await client.close();
            }
        } finally {
            Config.mongoDb = original;
        }
    });

    test('closeDatabase closes the pooled client and the next call reconnects', async () => {
        const before = await collection<Widget>('widgets');
        await before.insertOne({ name: 'preclose', value: 1 } as Widget);

        await closeDatabase();

        const after = await collection<Widget>('widgets');
        const found = await after.findOne({ name: 'preclose' });
        expect(found?.value).toBe(1);
    });
});
