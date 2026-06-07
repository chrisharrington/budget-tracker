import { describe, expect, test } from 'bun:test';
import pino, { Logger } from 'pino';

import { normalizeLogEntry, recordClientLog } from '.';

describe('normalizeLogEntry', () => {
    test('parses a structured JSON entry', () => {
        const entry = normalizeLogEntry(JSON.stringify({ level: 'warn', message: 'careful', error: 'boom' }));
        expect(entry).toEqual({ level: 'warn', message: 'careful', error: 'boom' });
    });

    test('treats a bare string as the message at info', () => {
        expect(normalizeLogEntry('Error fetching budget.')).toEqual({ level: 'info', message: 'Error fetching budget.' });
    });

    test('falls back to the raw body when the JSON object has no message', () => {
        const raw = JSON.stringify({ level: 'error' });
        expect(normalizeLogEntry(raw)).toEqual({ level: 'error', message: raw, error: undefined });
    });

    test('clamps an unknown level to info', () => {
        expect(normalizeLogEntry(JSON.stringify({ level: 'verbose', message: 'hi' })).level).toBe('info');
    });
});

describe('recordClientLog', () => {
    function capture(): { log: Logger, records: () => Array<Record<string, unknown>> } {
        const lines: string[] = [];
        const log = pino({ level: 'trace' }, { write: (line: string) => { lines.push(line); } });
        return { log, records: () => lines.map(line => JSON.parse(line)) };
    }

    test('emits a structured record at the requested level with the message', () => {
        const { log, records } = capture();
        recordClientLog(JSON.stringify({ level: 'warn', message: 'careful' }), log);

        const [record] = records();
        expect(record.level).toBe(40); // pino numeric level for warn
        expect(record.msg).toBe('careful');
        expect(record.source).toBe('app');
    });

    test('logs a legacy bare-string body at info', () => {
        const { log, records } = capture();
        recordClientLog('plain message', log);

        const [record] = records();
        expect(record.level).toBe(30); // info
        expect(record.msg).toBe('plain message');
    });

    test('attaches an error payload when present and omits it otherwise', () => {
        const withError = capture();
        recordClientLog(JSON.stringify({ level: 'error', message: 'failed', error: 'boom' }), withError.log);
        expect(withError.records()[0].err).toBeDefined();

        const withoutError = capture();
        recordClientLog(JSON.stringify({ message: 'ok' }), withoutError.log);
        expect(withoutError.records()[0].err).toBeUndefined();
    });
});
