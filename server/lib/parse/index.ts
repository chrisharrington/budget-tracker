import { Device, Tag, Transaction } from '@lib/models';

// Hand-rolled request-body coercion for the plain-object models. These replace the old
// `Transaction.fromRaw` / `Device.fromRaw` static factories. When the Zod request-validation ticket
// lands, the parsing/validation here is the natural thing to swap for a schema parse.

type RawTransaction = {
    _id: string;
    amount: number;
    date: string | Date;
    description: string;
    owner: string;
    ignored: boolean;
    tags?: Tag[];
};

type RawDevice = {
    _id?: string;
    token: string;
};

export function parseTransaction(raw: RawTransaction): Transaction {
    return {
        _id: raw._id,
        amount: raw.amount,
        date: new Date(raw.date),
        description: raw.description,
        owner: raw.owner,
        ignored: raw.ignored,
        tags: raw.tags ?? []
    };
}

export function parseDevice(raw: RawDevice): Device {
    return { _id: raw._id, token: raw.token } as Device;
}

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
