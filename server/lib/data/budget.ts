import { BudgetItem } from '@lib/models';
import dayjs from 'dayjs';

import { Base } from './base';

class BudgetService extends Base<BudgetItem> {
    constructor() {
        super('budgetItems');
    }

    async get(id: number) : Promise<BudgetItem[]> {
        return await this.find({ id });
    }

    async getForWeek(date: Date) : Promise<BudgetItem[]> {
        return await this.find({
            date: {
                $gte: dayjs(date).startOf('w').toDate(),
                $lte: dayjs(date).endOf('w').toDate()
            }
        }, { date: -1 });
    }

    async save(items: BudgetItem[]) : Promise<void> {
        await Promise.all(items.map((item: BudgetItem) => (
            this.updateOne(item)
        )));
    }
}

export default new BudgetService();