import { Transaction } from '@lib/models';

// Clones a transaction's data fields but deliberately omits `_id` so the split handler can persist
// the result as a brand-new document (`insertOne` then assigns a fresh id). `tags` is copied into a
// new array so mutating the clone never leaks back into the original.
export function copyTransaction(t: Transaction): Transaction {
    return {
        amount: t.amount,
        date: t.date,
        description: t.description,
        owner: t.owner,
        ignored: t.ignored,
        tags: [...t.tags]
    } as Transaction;
}
