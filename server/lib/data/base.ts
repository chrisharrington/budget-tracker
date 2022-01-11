import { Collection, MongoClient, ObjectID, ObjectId } from 'mongodb';

import Config from '@lib/config';
import { Id } from '@lib/models';

export class Base<TModel> {
    private connectionString: string;
    private collection: string;

    constructor(collection: string, index?: any) {
        this.connectionString = Config.databaseConnectionString;
        this.collection = collection;

        if (index)
            this.connect().then(c => c.createIndex(index));
    }

    protected async connect(collection?: string) : Promise<Collection> {
        return new Promise<Collection>((resolve, reject) => {
            MongoClient.connect(this.connectionString, { useUnifiedTopology:true }, (error, client) => {
                if (error) reject(error);
                else resolve(client.db('budget').collection(collection || this.collection));
            });
        });
    }

    public async findById(id: string) : Promise<TModel | null> {
        return await this.findOne({ _id: new ObjectID(id) });
    }

    public async findOne(query: any, sort?: any) : Promise<TModel | null> {
        let result = await this.find(query, sort);
        return result[0];
    }

    public async find(query: any, sort?: any, limit?: number) : Promise<TModel[]> {
        let collection = await this.connect();

        return new Promise<TModel[]>((resolve, reject) => {
            let q = collection.find(query);
            if (sort)
                q = q.sort(sort);
            if (limit)
                q = q.limit(limit);
            q.toArray((error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });
    }

    public async search(query: string) : Promise<TModel[]> {
        let collection = await this.connect();

        return new Promise<TModel[]>((resolve, reject) => {
            collection.find({ $text: { $search: query } })
                .project({ score: { $meta: 'textScore' } })
                .sort({ score: { $meta: 'textScore' } })
                .toArray((error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
        });
    }

    public async insertOne(model: TModel) : Promise<TModel> {
        let collection = await this.connect();

        return new Promise<TModel>((resolve, reject) => {
            collection.insertOne(model, (error, response) => {
                if (error) reject(error);
                else {
                    (model as any)._id = new ObjectId(response.insertedId);
                    resolve(model);
                }
            });
        });
    }

    public async updateOne(model: Id) : Promise<void> {
        let collection = await this.connect();

        return new Promise<void>((resolve, reject) => {
            let update = {};
            Object.keys(model).forEach(key => {
                if (key !== '_id')
                    update[key] = model[key];
            });
            collection.updateOne({
                _id: new ObjectID(model._id)
            }, {
                $set: update
            }, (error) => {
                if (error) reject(error);
                else resolve();
            })
        });
    }

    public async remove(model: Id) : Promise<void> {
        let collection = await this.connect();

        return new Promise<void>((resolve, reject) => {
            collection.deleteOne({
                _id: new ObjectID(model._id)
            }, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    }
}