import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { Tag } from '@lib/models';

let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let TagService: typeof import('.');
let collection: typeof import('@lib/data/base').collection;
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    TagService = await import('.');
    ({ collection, closeDatabase } = await import('@lib/data/base'));

    // Seed names out of order so the sort is actually exercised. t00..t11.
    const tags = await collection<Tag>('tags');
    await tags.insertMany(
        ['t05', 't00', 't11', 't03', 't08', 't01', 't09', 't02', 't10', 't07', 't04', 't06'].map(
            name => ({ name, ignore: false }) as Tag,
        ),
    );
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

describe('TagService.getRecent', () => {
    test('returns at most `count` tags sorted by name ascending', async () => {
        const names = (await TagService.getRecent(3)).map(tag => tag.name);
        expect(names).toEqual(['t00', 't01', 't02']);
    });

    test('defaults to 10 tags', async () => {
        const tags = await TagService.getRecent();
        expect(tags.length).toBe(10);
        expect(tags[0].name).toBe('t00');
        expect(tags[9].name).toBe('t09');
    });
});

describe('TagService.getByNames', () => {
    test('returns only the tags whose name is in the set', async () => {
        const names = (await TagService.getByNames(['t05', 't02'])).map(tag => tag.name).sort();
        expect(names).toEqual(['t02', 't05']);
    });

    test('returns an empty array when no names match', async () => {
        expect(await TagService.getByNames(['nope'])).toEqual([]);
    });
});
