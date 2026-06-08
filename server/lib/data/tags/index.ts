import { Tag } from '@lib/models';

import { collection } from '@lib/data/base';

const tags = () => collection<Tag>('tags');

export async function getByNames(names: string[]): Promise<Tag[]> {
    const collection = await tags();
    return await collection.find({ name: { $in: names } }).toArray() as Tag[];
}

export async function getRecent(count: number = 10): Promise<Tag[]> {
    const collection = await tags();
    return await collection.find({}).sort({ name: 1 }).limit(count).toArray() as Tag[];
}
