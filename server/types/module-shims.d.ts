// Ambient declarations for third-party modules that ship no usable type definitions.
// Typed to match how this codebase actually consumes them rather than falling back to `any`.

declare module 'cron' {
    export class CronJob {
        constructor(
            cronTime: string,
            onTick: () => void,
            onComplete?: (() => void) | null,
            start?: boolean,
            timeZone?: string
        );
        start(): void;
        stop(): void;
        nextDates(count?: number): Date | Date[];
    }
}

declare module 'get-timezone-offset' {
    // Returns the offset, in minutes, of the given IANA time zone for an optional date.
    export default function getTimezoneOffset(timeZone: string, date?: Date): number;
}

declare module 'dayjs-ext/plugin/timeZone' {
    import { PluginFunc } from 'dayjs';
    const plugin: PluginFunc;
    export default plugin;
}

declare module 'mailparser-mit' {
    import { Writable } from 'stream';

    export interface ParsedMail {
        html: string;
        subject: string;
        receivedDate: Date;
    }

    export class MailParser extends Writable {
        on(event: 'end', listener: (mail: ParsedMail) => void): this;
        once(event: 'end', listener: (mail: ParsedMail) => void): this;
    }
}
