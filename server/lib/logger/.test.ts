import { describe, expect, test } from 'bun:test';

import logger, { resolveLevel } from '.';

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
});
