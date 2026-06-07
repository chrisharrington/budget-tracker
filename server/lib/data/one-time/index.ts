import { Base } from '@lib/data/base';

import TransactionService from '@lib/data/transaction';
import logger from '@lib/logger';
import { OneTime, Tag, Transaction } from '@lib/models';

const ONE_TIME_TAG = 'one-time';

// Signed amount to apply to the one-time balance for a transaction's tag transition: spend from the
// pool when the one-time tag is newly added, refund it when removed, otherwise no change. Two
// independent `.some()` checks — keeping the `&&` between them, not inside a callback.
export function oneTimeBalanceDelta(oldTags: Tag[], newTags: Tag[], amount: number): number {
    const hadOneTime = oldTags.some(tag => tag.name === ONE_TIME_TAG);
    const hasOneTime = newTags.some(tag => tag.name === ONE_TIME_TAG);

    if (!hadOneTime && hasOneTime) return -amount;
    if (hadOneTime && !hasOneTime) return amount;
    return 0;
}

class OneTimeService extends Base<OneTime> {
    constructor() {
        super('one-time');
    }

    async get() : Promise<OneTime> {
        const oneTime = await this.findOne({});
        if (!oneTime)
            throw new Error('No one-time balance record found.');
        return oneTime;
    }

    async applyTransaction(newTransaction: Transaction) : Promise<void> {
        const oldTransaction = await TransactionService.findById(newTransaction._id),
            oneTime = await this.get();

        if (!oldTransaction)
            throw new Error(`Transaction not found: ${newTransaction._id}.`);

        oneTime.balance += oneTimeBalanceDelta(oldTransaction.tags, newTransaction.tags, newTransaction.amount);

        await this.updateOne(oneTime);
    }

    async addAmount(amount: number) : Promise<void> {
        logger.info({ amount }, 'Adding one-time amount.');

        const oneTime = await this.get();
        oneTime.balance += amount;
        await this.updateOne(oneTime);
    }
}

export default new OneTimeService();