import { Transaction } from '@lib/models';

// Extracts a transaction from a bank notification email's HTML body. Moved verbatim from the old
// `Transaction.fromMessage` static — hardening this extraction is the email-parsing ticket's concern.
export function parseMessage(raw: string, date: Date): Transaction {
    const parsed = raw.substring(raw.indexOf('$'));
    const words = parsed
        .substring(0, parsed.indexOf('<br'))
        .replace('<sup>', '')
        .replace('</sup>', '')
        .replace('&#174;', '')
        .split(' ')
        .filter(w => w.trim().length > 0);

    const transaction: Omit<Transaction, '_id'> = {
        amount: parseFloat(words[0].replace('$', '').replace(',', '')),
        date,
        description: words.slice(words.indexOf('at') + 1, words.lastIndexOf('on')).join(' '),
        owner: parsed.indexOf('1379') > -1 ? 'Chris' : 'Sarah',
        ignored: false,
        tags: []
    };

    return transaction as Transaction;
}
