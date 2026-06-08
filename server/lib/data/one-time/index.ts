import { ObjectId } from 'mongodb';

import TransactionService from '@lib/data/transaction';
import logger from '@lib/logger';
import { OneTime, Tag, Transaction } from '@lib/models';
import { collection } from '@lib/data/base';

const ONE_TIME_TAG = 'one-time';

const oneTimes = () => collection<OneTime>('one-time');

// Signed amount to apply to the one-time balance for a transaction's tag transition: spend from the
// pool when the one-time tag is newly added, refund it when removed, otherwise no change. Two
// independent `.some()` checks — keeping the `&&` between them, not inside a callback.
export function oneTimeBalanceDelta(oldTags: Tag[], newTags: Tag[], amount: number): number {
    const hadOneTime = oldTags.some(tag => tag.name === ONE_TIME_TAG);
    const hasOneTime = newTags.some(tag => tag.name === ONE_TIME_TAG);

    if (!hadOneTime && hasOneTime) return -amount;
    if (hadOneTime && !hasOneTime) return amount;
    return 0;
}

async function update(oneTime: OneTime): Promise<void> {
    const collection = await oneTimes();
    const { _id, ...rest } = oneTime;
    // The model carries a string `_id`, but the stored documents key on ObjectId — cast the filter at
    // this driver boundary (the same shape the old Base class used).
    await collection.updateOne({ _id: new ObjectId(_id) } as object, { $set: rest });
}

export async function get(): Promise<OneTime> {
    const collection = await oneTimes();
    const oneTime = await collection.findOne({}) as OneTime | null;
    if (!oneTime)
        throw new Error('No one-time balance record found.');
    return oneTime;
}

export async function applyTransaction(newTransaction: Transaction): Promise<void> {
    const oldTransaction = await TransactionService.findById(newTransaction._id),
        oneTime = await get();

    if (!oldTransaction)
        throw new Error(`Transaction not found: ${newTransaction._id}.`);

    oneTime.balance += oneTimeBalanceDelta(oldTransaction.tags, newTransaction.tags, newTransaction.amount);

    await update(oneTime);
}

export async function addAmount(amount: number): Promise<void> {
    logger.info({ amount }, 'Adding one-time amount.');

    const oneTime = await get();
    oneTime.balance += amount;
    await update(oneTime);
}
