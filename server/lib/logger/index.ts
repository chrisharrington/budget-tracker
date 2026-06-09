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

export function buildOptions(): LoggerOptions {
    // `base: null` drops pino's default pid/hostname bindings — in a container the pid is always ~1 and
    // the hostname is the random container id, so they're pure noise. Applies to JSON and pretty output
    // alike, and is inherited by pino-http and every logger.child(...).
    const options: LoggerOptions = { level: resolveLevel(), base: null };

    if (usePretty()) options.transport = { target: 'pino-pretty', options: { colorize: true } };

    return options;
}

const logger: Logger = pino(buildOptions());

export default logger;
