import { Transaction } from '@lib/models';
import dayjs from 'dayjs-ext';

import { Base } from './base';

import timeZonePlugin from 'dayjs-ext/plugin/timeZone';

dayjs.extend(timeZonePlugin);

class TransactionService extends Base<Transaction> {
    constructor() {
        super('transactions');
    }

    async get(id: number) : Promise<Transaction[]> {
        return await this.find({ id });
    }

    async getForWeek(date: Date) : Promise<Transaction[]> {
        return await this.find({
            date: {
                $gte: dayjs(date).add(1, 'day').startOf('week').toDate(),
                $lte: dayjs(date).add(1, 'day').endOf('week').toDate()
            }
        }, { date: -1 });
    }

    async save(items: Transaction[]) : Promise<void> {
        await Promise.all(items.map((item: Transaction) => (
            this.updateOne(item)
        )));
    }
}

export default new TransactionService();