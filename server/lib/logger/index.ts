import pino, { Logger, LoggerOptions } from 'pino';

// The logger is the lowest-level module in the app: it reads LOG_LEVEL straight from the environment
// rather than depending on Config, so any module (Config included) can import it without a cycle.

export function resolveLevel(env: NodeJS.ProcessEnv = process.env): string {
    return env.LOG_LEVEL ?? 'info';
}

// Pretty-print only for an interactive local dev terminal. Containers — and the test runner — get
// structured JSON (what log aggregation wants), which also avoids spawning the pino-pretty worker
// thread during tests. Keyed off a TTY as well as NODE_ENV because the dev compose stack itself runs
// with NODE_ENV=production.
function usePretty(): boolean {
    return process.env.NODE_ENV !== 'production' && !!process.stdout.isTTY;
}

function buildOptions(): LoggerOptions {
    const options: LoggerOptions = { level: resolveLevel() };

    if (usePretty()) options.transport = { target: 'pino-pretty', options: { colorize: true } };

    return options;
}

const logger: Logger = pino(buildOptions());

export default logger;
