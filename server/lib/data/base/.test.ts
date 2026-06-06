import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Config from '@lib/config';

import { Base } from '.';

// Integration coverage for the data layer: boot a real ephemeral mongod and drive reads/writes
// through the actual `Base` class (no mocking of the data layer). The only boundary we swap is the
// connection string, which `Base` reads from `Config` at construction time.

interface Widget {
    _id: string;
    name: string;
    value: number;
}

let mongod!: MongoMemoryServer;
let widgets!: Base<Widget>;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config.databaseConnectionString = mongod.getUri();
    widgets = new Base<Widget>('widgets');
});

afterAll(async () => {
    await mongod.stop();
});

describe('Base', () => {
    test('persists a document and reads it back by query', async () => {
        const inserted = await widgets.insertOne({ name: 'alpha', value: 1 } as Widget);
        expect(inserted._id).toBeDefined();

        const found = await widgets.findOne({ name: 'alpha' });
        expect(found?.value).toBe(1);
    });

    test('finds a document by its generated id', async () => {
        const inserted = await widgets.insertOne({ name: 'byid', value: 7 } as Widget);

        const found = await widgets.findById(String(inserted._id));
        expect(found?.value).toBe(7);
    });

    test('returns every document matching a query', async () => {
        await widgets.insertOne({ name: 'shared', value: 10 } as Widget);
        await widgets.insertOne({ name: 'shared', value: 20 } as Widget);

        const found = await widgets.find({ name: 'shared' });
        expect(found.map(w => w.value).sort((first, second) => first - second)).toEqual([10, 20]);
    });

    test('updates an existing document', async () => {
        const inserted = await widgets.insertOne({ name: 'updatable', value: 1 } as Widget);

        inserted.value = 42;
        await widgets.updateOne(inserted);

        const found = await widgets.findOne({ name: 'updatable' });
        expect(found?.value).toBe(42);
    });

    test('removes a document', async () => {
        const inserted = await widgets.insertOne({ name: 'removable', value: 5 } as Widget);

        await widgets.remove(inserted);

        const remaining = await widgets.find({ name: 'removable' });
        expect(remaining.length).toBe(0);
    });
});
