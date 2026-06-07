import { Application, Request, Response, text } from 'express';
import { Logger } from 'pino';

import logger from '@lib/logger';

const VALID_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);

export interface ClientLogEntry {
    level: string;
    message: string;
    error?: unknown;
}

// Tolerant of two body shapes: the intended structured contract `{ level, message, error }`, and a
// bare string (what the app currently POSTs). Anything not a JSON object becomes the message itself,
// and an unknown level is clamped to `info`.
export function normalizeLogEntry(raw: string): ClientLogEntry {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { level: 'info', message: raw };
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const body = parsed as { level?: unknown; message?: unknown; error?: unknown };
        const level = typeof body.level === 'string' && VALID_LEVELS.has(body.level) ? body.level : 'info';
        const message = typeof body.message === 'string' ? body.message : raw;
        return { level, message, error: body.error };
    }

    return { level: 'info', message: raw };
}

// Emits one structured record through pino. The logger is injectable so tests can capture output.
export function recordClientLog(raw: string, log: Logger = logger): void {
    const entry = normalizeLogEntry(raw);
    const context = entry.error === undefined ? { source: 'app' } : { source: 'app', err: entry.error };

    switch (entry.level) {
        case 'fatal': log.fatal(context, entry.message); break;
        case 'error': log.error(context, entry.message); break;
        case 'warn': log.warn(context, entry.message); break;
        case 'debug': log.debug(context, entry.message); break;
        case 'trace': log.trace(context, entry.message); break;
        default: log.info(context, entry.message);
    }
}

export default class Log {
    static initialize(app: Application) {
        app.post('/log', text({ type: '*/*' }), this.log.bind(this));

        app.get('/test', (_: Request, response: Response) => response.send('Log service is running!').status(200));
    }

    private static async log(request: Request, response: Response) {
        const raw = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
        recordClientLog(raw);
        response.sendStatus(200);
    }
}
