import { Balance } from '@lib/models';
import { collection } from '@lib/data/base';

const balances = () => collection<Balance>('balances');

// A unique index on weekOf turns the concurrent-upsert insert race into a server-side retry, so at
// most one Balance document can exist per week. `createIndex` is idempotent — calling it ahead of each
// upsert is a no-op once the index exists, and keeps the guarantee correct across reconnects.
export async function ensureWeekOfIndex(): Promise<void> {
    const collection = await balances();
    await collection.createIndex({ weekOf: 1 }, { unique: true });
}

export async function findForWeek(weekOf: Date): Promise<Balance | null> {
    const collection = await balances();
    return (await collection.findOne({ weekOf })) as Balance | null;
}

// Atomically create-or-update the balance for a week. With the unique weekOf index and an equality
// filter, concurrent callers converge on a single document instead of racing insert/insert.
export async function upsertForWeek(weekOf: Date, amount: number): Promise<void> {
    await ensureWeekOfIndex();
    const collection = await balances();
    await collection.updateOne({ weekOf }, { $set: { amount } }, { upsert: true });
}
