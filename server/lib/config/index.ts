import dayjs from 'dayjs';

// Parses a comma-separated `CORS_ORIGINS` value into a trimmed allowlist, dropping blank entries.
export function parseCorsOrigins(value: string | undefined): string[] {
    return (value ?? '').split(',').map(origin => origin.trim()).filter(Boolean);
}

// Parses the `CARD_OWNER_MAP` JSON env (card last-4 → owner name) into a plain string map. Anything
// that isn't a JSON object of string values yields an empty map; the mail parser then drops (and
// logs) any transaction whose card isn't present rather than mis-attributing it.
export function parseCardOwnerMap(value: string | undefined): Record<string, string> {
    if (!value)
        return {};

    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        return {};
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return {};

    const map: Record<string, string> = {};
    for (const [card, owner] of Object.entries(parsed))
        if (typeof owner === 'string')
            map[card] = owner;

    return map;
}

export default class Config {
    static databaseConnectionString: string = process.env.MONGO_URI ?? 'mongodb://database:27017';
    static mongoDb: string = process.env.MONGO_DB ?? 'budget';
    static mailHost: string = process.env.MAIL_HOST ?? '';
    static mailEmailAddress: string = process.env.MAIL_USER ?? '';
    static mailPassword: string = process.env.MAIL_PASSWORD ?? '';
    static expoAccessToken: string | undefined = process.env.EXPO_ACCESS_TOKEN;
    static apiKey: string | undefined = process.env.API_KEY;
    static corsOrigins: string[] = parseCorsOrigins(process.env.CORS_ORIGINS);
    static cardOwnerMap: Record<string, string> = parseCardOwnerMap(process.env.CARD_OWNER_MAP);
    static timezone: string = 'America/Edmonton';
    static remainingBalanceUpdateCron: string = '0 0 * * MON';
    static oneTimeBalanceUpdateCron: string = '0 0 1 * *';
    static notificationReceiptCron: string = '*/15 * * * *';

    // Fail loud at startup rather than silently connecting with empty credentials. Reads the static
    // fields (not process.env directly) so they remain the single source of truth.
    static assertMailConfig() {
        const missing: string[] = [];
        if (!this.mailHost) missing.push('MAIL_HOST');
        if (!this.mailEmailAddress) missing.push('MAIL_USER');
        if (!this.mailPassword) missing.push('MAIL_PASSWORD');

        if (missing.length)
            throw new Error(`Missing required mail configuration: ${missing.join(', ')}. Set these environment variables.`);
    }

    static weeklyAmount = (date: Date) => {
        if (date >= new Date(2025, 0, 1))
            return 400;
        if (date >= new Date(2024, 7, 19))
            return 750;
        if (date >= new Date(2021, 11, 5))
            return 800;
        if (date >= new Date(2021, 7, 16))
            return 1000;
        return 500;
    }

    static oneTimeAmount = (date: Date = new Date()) => {
        return date >= new Date(2024, 11, 15) ? 2000 : 1500;
    }
} 