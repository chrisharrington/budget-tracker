import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { CronJob } from 'cron';

import { Balance, Tag, Transaction } from '@lib/models';

import TransactionService from '@lib/data/transaction';
import BalanceService from '@lib/data/balance';

import Config from './config';

dayjs.extend(utc);
dayjs.extend(timezone);


class Balances {
    async startWeeklyJob() {
        await this.upsertBalanceFromPreviousWeek();

        const job = new CronJob(Config.balanceUpdateCron, async () => {
            await this.upsertBalanceFromPreviousWeek();
        }, null, true, Config.timezone);

        job.start();

        console.log(`Started weekly job to update balance. Next run on ${job.nextDates().toDate()}`);
    }

    async upsertBalanceFromPreviousWeek(force: boolean = false) {
        console.log('Updating balance for previous week.');

        const startOfPreviousWeek = dayjs().tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week').toDate();
        console.log('Previous week start date is ' + startOfPreviousWeek);
        let balance = await BalanceService.findOne({ weekOf: startOfPreviousWeek });
        if (balance && !force) {
            console.log('Balance found. Skipping.');
            return;
        }
            
        const transactions = await TransactionService.getForWeek(startOfPreviousWeek),
            isUpdate = !!balance;

        let sum = transactions
            .filter((transaction: Transaction) => !transaction.ignored && transaction.tags.every((tag: Tag) => !tag.ignore))
            .map((transaction: Transaction) => transaction.amount)
            .reduce((sum: number, curr: number) => sum + curr, 0);

        const lastWeeksBalance = await BalanceService.findOne({
            weekOf: {
                $gt: dayjs(startOfPreviousWeek).subtract(1, 'week').subtract(1, 'day').toDate(),
                $lt: dayjs(startOfPreviousWeek).subtract(1, 'week').add(1, 'day').toDate()
            }
        });

        if (lastWeeksBalance)
            sum -= lastWeeksBalance.amount;

        if (!balance) {
            balance = new Balance();
            balance.weekOf = startOfPreviousWeek;
            balance = await BalanceService.insertOne(balance);
        }

        balance.amount = Config.weeklyAmount(startOfPreviousWeek) - sum;
        await BalanceService.updateOne(balance);

        console.log(`${isUpdate ? 'Updated' : 'Inserted'} balance with amount ${balance.amount.toFixed(2)}.`)
    }
}

export default new Balances();