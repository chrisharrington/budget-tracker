import { ObjectId, Sort } from 'mongodb';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import Config from '@lib/config';
import { Transaction } from '@lib/models';
import { collection } from '@lib/data/base';

dayjs.extend(utc);
dayjs.extend(timezone);

const transactions = () => collection<Transaction>('transactions');

export async function find(query: object, sort?: Sort): Promise<Transaction[]> {
    const collection = await transactions();
    let cursor = collection.find(query);
    if (sort)
        cursor = cursor.sort(sort);
    return await cursor.toArray() as Transaction[];
}

export async function findById(id: string): Promise<Transaction | null> {
    const collection = await transactions();
    return await collection.findOne({ _id: new ObjectId(id) } as object) as Transaction | null;
}

export async function getForWeek(date: Date): Promise<Transaction[]> {
    // Localize the week-start to Edmonton and take that day's midnight, then span a full week.
    // Using dayjs's timezone plugin keeps the boundary correct per-instant across DST changes,
    // unlike a fixed offset baked in at construction time.
    const start = dayjs(date).tz(Config.timezone).startOf('day');
    const end = start.add(1, 'week').subtract(1, 'second');

    return await find({ date: { $gte: start.toDate(), $lte: end.toDate() } }, { date: -1 });
}

export async function insertOne(transaction: Transaction): Promise<Transaction> {
    const collection = await transactions();
    const result = await collection.insertOne(transaction as object as Transaction);
    transaction._id = result.insertedId as unknown as string;
    return transaction;
}

export async function updateOne(transaction: Transaction): Promise<void> {
    const collection = await transactions();
    // The model carries a string `_id`, but stored documents key on ObjectId — cast the filter at this
    // driver boundary (the same shape the old Base class used).
    const { _id, ...rest } = transaction;
    await collection.updateOne({ _id: new ObjectId(_id) } as object, { $set: rest });
}
