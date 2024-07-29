import { CronJob } from 'cron';
import dayjs from 'dayjs';
import Config from '@lib/config';
import TransactionService from '@lib/data/transaction';

export function startWeeklyAllowanceJob() {
    const job = new CronJob(Config.allowanceUpdateCron, async () => {
        await updateAllowance('quinn');
        await updateAllowance('zoe');
    }, null, true, Config.timezone);

    job.start();

    console.log(`Started weekly job to update allowances. Next run on ${job.nextDates()}`);
}

export async function addOneTimeAllowancePayment(owner: 'quinn' | 'zoe', amount: number) {
    console.log(`Adding one-time allowance for ${owner}. Amount: ${amount}.`);
    await TransactionService.insertAllowancePayment(owner, amount);
}

async function updateAllowance(owner: 'quinn' | 'zoe') {

    const transactions = await TransactionService.getAllowanceTransactions(owner),
        lastIncrease = transactions.find(transaction => transaction.isAllowancePayment),
        lastPurchase = transactions.find(transaction => transaction.isAllowancePayment === undefined);

    let amount = 0;
    if (!lastIncrease || !lastPurchase || dayjs(lastPurchase.date).isAfter(dayjs(lastIncrease.date))) {
        amount = Config.allowanceBaseWeeklyAmount;
    } else {
        amount = Math.min(Config.allowanceMax, lastIncrease.amount + Config.allowanceIncrement);
    }

    console.log(`Updating allowance for ${owner}. Amount will be increased by ${amount}.`);
    await TransactionService.insertAllowancePayment(owner, amount);
}