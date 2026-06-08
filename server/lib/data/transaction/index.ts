import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import Config from '@lib/config';
import { Transaction } from '@lib/models';
import { Base } from '@lib/data/base';

dayjs.extend(utc);
dayjs.extend(timezone);

class TransactionService extends Base<Transaction> {
    constructor() {
        super('transactions');
    }

    async get(id: number) : Promise<Transaction[]> {
        return await this.find({ id });
    }

    async getForWeek(date: Date) : Promise<Transaction[]> {
        // Localize the week-start to Edmonton and take that day's midnight, then span a full week.
        // Using dayjs's timezone plugin keeps the boundary correct per-instant across DST changes,
        // unlike a fixed offset baked in at construction time.
        const start = dayjs(date).tz(Config.timezone).startOf('day');
        const end = start.add(1, 'week').subtract(1, 'second');

        return await this.find({
            date: {
                $gte: start.toDate(),
                $lte: end.toDate()
            }
        }, { date: -1 });
    }

    async getAllowanceTransactions(owner: string) : Promise<Transaction[]> {
        return await this.find({
            $or: [
                {
                    tags: {
                        $elemMatch: {
                            name: owner
                        }
                    }
                }
            ]
        }, {
            date: -1
        });
    }

    async save(items: Transaction[]) : Promise<void> {
        await Promise.all(items.map((item: Transaction) => (
            this.updateOne(item)
        )));
    }
}

export default new TransactionService();
