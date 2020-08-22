import { Application, Request, Response } from 'express';
import dayjs from 'dayjs';

import Config from '@lib/config';
import BudgetService from '@lib/data/budget';
import { Budget, BudgetItem } from '@lib/models';

export default class BudgetRoute {
    static initialize(app: Application) {
        app.get('/', this.getCurrentBudget.bind(this));
    }

    private static async getCurrentBudget(_: Request, response: Response) {
        try {
            console.log('Request received: GET /');
            
            const current = await BudgetService.getForWeek(dayjs().startOf('w').toDate()),
                last = await BudgetService.getForWeek(dayjs().subtract(1, 'w').startOf('w').toDate());

            response.status(200).send(new Budget({
                weeklyAmount: Config.weeklyAmount,
                lastWeekRemaining: Config.weeklyAmount - last
                    .map((l: BudgetItem) => l.amount)
                    .reduce((amount: number, sum: number) => sum + amount, 0),
                items: current
            }));
        } catch (e) {
            console.log('Request failed: GET /');
            console.error(e);
            response.status(500).send(e);
        }
    }
}