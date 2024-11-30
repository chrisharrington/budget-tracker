import { Base } from './base';

import TransactionService from '@lib/data/transaction';
import { OneTime, Transaction } from '@lib/models';

const ONE_TIME_TAG = 'one-time';

class OneTimeService extends Base<OneTime> {
    constructor() {
        super('one-time');
    }

    async get() : Promise<OneTime> {
        return await this.findOne({});
    }

    async applyTransaction(newTransaction: Transaction) : Promise<void> {
        const oldTransaction = await TransactionService.findById(newTransaction._id),
            oneTime = await this.get();

        if (oldTransaction.tags.every(t => t.name !== ONE_TIME_TAG) && newTransaction.tags.some(t => t.name === ONE_TIME_TAG))
            oneTime.balance -= newTransaction.amount;
        else if (oldTransaction.tags.some(t => t.name === ONE_TIME_TAG && newTransaction.tags.every(t => t.name !== ONE_TIME_TAG)))
            oneTime.balance += newTransaction.amount;
        
        await this.updateOne(oneTime);
    }

    async addAmount(amount: number) : Promise<void> {
        console.log('Adding one-time amount: ' + amount);

        const oneTime = await this.get();
        oneTime.balance += amount;
        await this.updateOne(oneTime);
    }
}

export default new OneTimeService();