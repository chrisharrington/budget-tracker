import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { Transaction } from '@lib/models';

dayjs.extend(utc);
dayjs.extend(timezone);

const tz = 'America/Edmonton';

// Imported in beforeAll after pointing Config at the in-memory Mongo (the shared pooled client reads
// the connection string on first use).
let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let TransactionService: typeof import('.').default;
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

// Each fixture is [description, instant]. The summer and winter weeks are months apart so their
// query windows never overlap — every getForWeek call returns only its own week's rows.
const fixtures: ReadonlyArray<readonly [string, string]> = [
    // Summer week — Edmonton is MDT (UTC-6); the Monday-00:00 boundary is 06:00Z.
    ['summer-before', '2026-06-01T05:59:59.000Z'], // 1s before the window
    ['summer-start', '2026-06-01T06:00:00.000Z'],  // exactly the window start
    ['summer-mid', '2026-06-04T12:00:00.000Z'],
    ['summer-end', '2026-06-08T05:59:59.000Z'],    // exactly the window end
    ['summer-after', '2026-06-08T06:00:00.000Z'],  // 1s after the window
    // Winter week — Edmonton is MST (UTC-7); the Monday-00:00 boundary is 07:00Z.
    ['winter-dst-trap', '2026-01-12T06:30:00.000Z'], // inside a *summer*-offset window, outside MST
    ['winter-start', '2026-01-12T07:00:00.000Z'],
    ['winter-end', '2026-01-19T06:59:59.000Z']
];

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    TransactionService = (await import('.')).default;
    ({ closeDatabase } = await import('@lib/data/base'));

    for (const [description, iso] of fixtures)
        await TransactionService.insertOne({
            amount: 10,
            date: new Date(iso),
            description,
            owner: 'Chris',
            ignored: false,
            tags: []
        } as Transaction);
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

describe('TransactionService.getForWeek', () => {
    test('spans the summer (MDT) week between Edmonton midnight boundaries', async () => {
        const monday = dayjs.tz('2026-06-01', tz).toDate();
        const descriptions = (await TransactionService.getForWeek(monday)).map(t => t.description);

        expect(descriptions).toContain('summer-start');
        expect(descriptions).toContain('summer-mid');
        expect(descriptions).toContain('summer-end');
        expect(descriptions).not.toContain('summer-before');
        expect(descriptions).not.toContain('summer-after');
    });

    test('uses the correct DST offset for a winter (MST) week', async () => {
        const monday = dayjs.tz('2026-01-12', tz).toDate();
        const descriptions = (await TransactionService.getForWeek(monday)).map(t => t.description);

        expect(descriptions).toContain('winter-start');
        expect(descriptions).toContain('winter-end');
        // The trap row sits at 06:30Z — it would be inside a summer-offset window but is correctly
        // excluded from the MST week, proving the boundary follows the per-instant offset.
        expect(descriptions).not.toContain('winter-dst-trap');
    });

    test('returns the week in descending date order', async () => {
        const monday = dayjs.tz('2026-06-01', tz).toDate();
        const times = (await TransactionService.getForWeek(monday)).map(t => new Date(t.date).getTime());

        expect(times).toEqual([...times].sort((a, b) => b - a));
    });
});
