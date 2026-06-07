import { Base } from './base';

import logger from '@lib/logger';
import { Balance } from '@lib/models';


class BalanceService extends Base<Balance> {
    private indexReady?: Promise<void>;

    constructor() {
        super('balances');
        this.ensureWeekOfIndex().catch(error => logger.error({ err: error }, 'Failed to create unique index on balances.weekOf.'));
    }

    // A unique index on weekOf turns the concurrent-upsert insert race into a server-side retry, so
    // at most one Balance document can exist per week. Memoized so repeated calls share one attempt.
    ensureWeekOfIndex(): Promise<void> {
        if (!this.indexReady)
            this.indexReady = this.connect().then(async collection => {
                await collection.createIndex({ weekOf: 1 }, { unique: true });
            });

        return this.indexReady;
    }

    // Atomically create-or-update the balance for a week. With the unique weekOf index and an equality
    // filter, concurrent callers converge on a single document instead of racing insert/insert.
    async upsertForWeek(weekOf: Date, amount: number): Promise<void> {
        const collection = await this.connect();
        await collection.updateOne({ weekOf }, { $set: { amount } }, { upsert: true });
    }
}

export default new BalanceService();
