import { Base } from './base';

import { Tag } from '@lib/models';


class TagService extends Base<Tag> {
    constructor() {
        super('tags');
    }

    async get(id: number) : Promise<Tag[]> {
        return await this.find({ id });
    }

    async getRecent(count: number = 10) : Promise<Tag[]> {
        return await this.find({}, { name: 1 }, count);
    }

    async save(items: Tag[]) : Promise<void> {
        await Promise.all(items.map((item: Tag) => (
            this.updateOne(item)
        )));
    }
}

export default new TagService();