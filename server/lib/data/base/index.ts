import { Collection, Document, MongoClient } from 'mongodb';

import Config from '@lib/config';

// A single shared, pooled MongoClient reused across every data service. Created lazily on first use
// (memoized) so it reads Config after startup/tests have set it and never connects during a
// pure-logic import. The driver maintains its own connection pool internally.
let clientPromise: Promise<MongoClient> | undefined;

function getClient(): Promise<MongoClient> {
    if (!clientPromise) clientPromise = MongoClient.connect(Config.databaseConnectionString);

    return clientPromise;
}

// Close the shared client (used by graceful shutdown; the signal wiring lives in a separate ticket).
// Safe to call when never connected, and a later operation transparently reconnects.
export async function closeDatabase(): Promise<void> {
    if (!clientPromise) return;

    const client = await clientPromise;
    clientPromise = undefined;
    await client.close();
}

// Typed accessor for a collection on the shared pooled client — the single shared data-layer
// primitive. Services are plain function modules that call this and use the driver API directly. The
// cast mirrors how the documents are actually shaped (models carry a string `_id`).
export async function collection<T extends Document>(name: string): Promise<Collection<T>> {
    const client = await getClient();
    return client.db(Config.mongoDb).collection(name) as unknown as Collection<T>;
}
