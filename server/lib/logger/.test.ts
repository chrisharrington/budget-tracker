import { describe, expect, test } from 'bun:test';
import pino from 'pino';

import logger, { buildOptions, resolveLevel } from '.';

describe('resolveLevel', () => {
    test('defaults to info when LOG_LEVEL is unset', () => {
        expect(resolveLevel({})).toBe('info');
    });

    test('honors LOG_LEVEL when set', () => {
        expect(resolveLevel({ LOG_LEVEL: 'debug' })).toBe('debug');
    });
});

describe('logger', () => {
    test('is configured at the resolved level', () => {
        expect(logger.level).toBe(resolveLevel());
    });

    test('exposes the standard pino level methods and logs without throwing', () => {
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(() => logger.info('logger smoke')).not.toThrow();
    });

    test('omits pid and hostname from emitted log lines while keeping level, time and message', () => {
        const lines: string[] = [];
        const captured = pino(buildOptions(), { write: (line: string) => lines.push(line) });

        captured.info('container log line');

        const entry = JSON.parse(lines[0]);
        expect(entry).not.toHaveProperty('pid');
        expect(entry).not.toHaveProperty('hostname');
        expect(entry.msg).toBe('container log line');
        expect(entry.level).toBeDefined();
        expect(entry.time).toBeDefined();
    });
});
