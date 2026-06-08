import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { z } from 'zod';

import Config from '@lib/config';
import logger from '@lib/logger';
import { Transaction } from '@lib/models';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const log = logger.child({ module: 'mail-parser' });

// Targeted extractors for the Tangerine notification email, replacing the old hunt-and-split parsing.
// Each captures exactly one field; a non-match throws so the transaction is dropped rather than
// guessed at. The merchant/card patterns are anchored on the " <card> at <merchant> on <date>" shape,
// and `.match` returns the first hit — so an incidental later "call us at 1-888-…" is ignored.
const AMOUNT = /\$([0-9,]+\.[0-9]{2})/;
const MERCHANT = / at (.+?) on /;
const CARD = /(\d{4})\s+at\s/;
const DATE = /\bon ([A-Z][a-z]+ \d{1,2}, \d{4})/;

const DATE_FORMAT = 'MMMM D, YYYY';

// Belt-and-suspenders validation of the assembled result; rejects (and the caller drops) if any field
// came out empty or non-finite despite a regex match.
const parsedSchema = z.object({
    amount: z.number().finite(),
    date: z.date(),
    description: z.string().min(1),
    owner: z.string().min(1)
});

function extract(pattern: RegExp, html: string, field: string): string {
    const match = html.match(pattern);
    if (!match) {
        log.warn({ field }, 'Email parse failed: could not extract field; dropping transaction.');
        throw new Error(`Email parse failed: could not extract ${field}.`);
    }
    return match[1];
}

// Extracts a transaction from a bank notification email's HTML body. Owner attribution comes from the
// CARD_OWNER_MAP env (card last-4 → name); the transaction date is read from the email itself (parsed
// in the configured timezone) rather than the IMAP receipt time.
export function parseMessage(raw: string): Transaction {
    const amount = parseFloat(extract(AMOUNT, raw, 'amount').replace(/,/g, ''));
    const description = extract(MERCHANT, raw, 'merchant').trim();
    const cardLast4 = extract(CARD, raw, 'card number');
    const dateText = extract(DATE, raw, 'date');

    const owner = Config.cardOwnerMap[cardLast4];
    if (!owner) {
        log.warn({ cardLast4 }, 'Unknown card number; dropping transaction to avoid mis-attribution.');
        throw new Error(`Email parse failed: card ${cardLast4} not present in CARD_OWNER_MAP.`);
    }

    const date = dayjs.tz(dateText, DATE_FORMAT, Config.timezone);
    if (!date.isValid()) {
        log.warn({ dateText }, 'Email parse failed: unparseable date; dropping transaction.');
        throw new Error(`Email parse failed: unparseable date "${dateText}".`);
    }

    const result = parsedSchema.safeParse({ amount, date: date.toDate(), description, owner });
    if (!result.success) {
        log.warn({ issues: result.error.issues }, 'Parsed email failed validation; dropping transaction.');
        throw result.error;
    }

    const transaction: Omit<Transaction, '_id'> = { ...result.data, ignored: false, tags: [] };
    return transaction as Transaction;
}
