import { Application, Request, Response } from 'express';
import dayjs from 'dayjs';

import Config from '@lib/config';
import BudgetService from '@lib/data/budget';
import { BudgetItem } from '@lib/models';

export default class Budget {
    static initialize(app: Application) {
        app.get('/', this.getCurrentBudget.bind(this));
    }

    private static async getCurrentBudget(_: Request, response: Response) {
        try {
            console.log('Request received: GET /');
            
            const current = await BudgetService.getForWeek(new Date()),
                last = await BudgetService.getForWeek(dayjs().startOf('w').subtract(1, 'd').toDate());

            response.status(200).send({
                weeklyAmount: Config.weeklyAmount,
                lastWeekRemaining: Config.weeklyAmount - last
                    .map((l: BudgetItem) => l.amount)
                    .reduce((amount: number, sum: number) => sum + amount, 0),
                items: current
            });
        } catch (e) {
            console.log('Request failed: GET /');
            console.error(e);
            response.status(500).send(e);
        }
    }
}