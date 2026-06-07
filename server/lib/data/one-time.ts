import { Base } from './base';

import TransactionService from '@lib/data/transaction';
import logger from '@lib/logger';
import { OneTime, Transaction } from '@lib/models';

const ONE_TIME_TAG = 'one-time';

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

        if (oldTransaction.tags.every(t => t.name !== ONE_TIME_TAG) && newTransaction.tags.some(t => t.name === ONE_TIME_TAG))
            oneTime.balance -= newTransaction.amount;
        else if (oldTransaction.tags.some(t => t.name === ONE_TIME_TAG && newTransaction.tags.every(t => t.name !== ONE_TIME_TAG)))
            oneTime.balance += newTransaction.amount;
        
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