import dayjs from 'dayjs';
import timeZonePlugin from 'dayjs-ext/plugin/timeZone';
import getTimezoneOffset from 'get-timezone-offset';

import { Base } from './base';

import { Transaction } from '@lib/models';


dayjs.extend(timeZonePlugin);

class TransactionService extends Base<Transaction> {
    constructor() {
        super('transactions');
    }

    async get(id: number) : Promise<Transaction[]> {
        return await this.find({ id });
    }

    async getForWeek(date: Date) : Promise<Transaction[]> {
        let start = dayjs(date).subtract(getTimezoneOffset('America/Edmonton'), 'minute').startOf('day');
        while (start.day() !== 1)
            start = start.subtract(1, 'day');

        return await this.find({
            date: {
                $gte: start.toDate(),
                $lte: dayjs(start).add(1, 'week').subtract(1, 'second').toDate()
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