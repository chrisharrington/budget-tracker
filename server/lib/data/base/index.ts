import { Collection, Document, MongoClient, ObjectId, OptionalUnlessRequiredId } from 'mongodb';

import Config from '@lib/config';
import { Id } from '@lib/models';

// A single shared, pooled MongoClient reused across every data service. Created lazily on first use
// (memoized) so it reads Config after startup/tests have set it and never connects during a
// pure-logic import. The driver maintains its own connection pool internally.
let clientPromise: Promise<MongoClient> | undefined;

function getClient(): Promise<MongoClient> {
    if (!clientPromise)
        clientPromise = MongoClient.connect(Config.databaseConnectionString);

    return clientPromise;
}

// Close the shared client (used by graceful shutdown; the signal wiring lives in a separate ticket).
// Safe to call when never connected, and a later operation transparently reconnects.
export async function closeDatabase(): Promise<void> {
    if (!clientPromise)
        return;

    const client = await clientPromise;
    clientPromise = undefined;
    await client.close();
}

// Typed accessor for a collection on the shared pooled client. Replaces the Base class as the single
// shared data-layer primitive — services are plain function modules that call this and use the driver
// API directly. The cast mirrors how Base treated documents (models carry a string `_id`).
export async function collection<T extends Document>(name: string): Promise<Collection<T>> {
    const client = await getClient();
    return client.db(Config.mongoDb).collection(name) as unknown as Collection<T>;
}

export class Base<TModel> {
    private collection: string;

    constructor(collection: string, index?: Parameters<Collection['createIndex']>[0]) {
        this.collection = collection;

        if (index)
            this.connect().then(c => c.createIndex(index)).catch(() => { /* index creation is best-effort */ });
    }

    protected async connect(collection?: string) : Promise<Collection> {
        const client = await getClient();
        return client.db(Config.mongoDb).collection(collection || this.collection);
    }

    public async findById(id: string) : Promise<TModel | null> {
        return await this.findOne({ _id: new ObjectId(id) });
    }

    public async findOne(query: any, sort?: any) : Promise<TModel | null> {
        const result = await this.find(query, sort);
        return result[0] ?? null;
    }

    public async find(query: any, sort?: any, limit?: number) : Promise<TModel[]> {
        const collection = await this.connect();

        let cursor = collection.find(query);
        if (sort)
            cursor = cursor.sort(sort);
        if (limit)
            cursor = cursor.limit(limit);

        return await cursor.toArray() as TModel[];
    }

    public async search(query: string) : Promise<TModel[]> {
        const collection = await this.connect();

        return await collection.find({ $text: { $search: query } })
            .project({ score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .toArray() as TModel[];
    }

    public async insertOne(model: TModel) : Promise<TModel> {
        const collection = await this.connect();

        const result = await collection.insertOne(model as OptionalUnlessRequiredId<TModel>);
        (model as any)._id = result.insertedId;
        return model;
    }

    public async updateOne(model: Id) : Promise<void> {
        const collection = await this.connect();

        const update: { [key: string]: unknown } = {};
        for (const [key, value] of Object.entries(model)) {
            if (key !== '_id')
                update[key] = value;
        }

        await collection.updateOne({ _id: new ObjectId(model._id) }, { $set: update });
    }

    public async remove(model: Id) : Promise<void> {
        const collection = await this.connect();
        await collection.deleteOne({ _id: new ObjectId(model._id) });
    }
}
