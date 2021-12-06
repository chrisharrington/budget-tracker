import { Application, Request, Response } from 'express';

import TagService from '@lib/data/tags';


export default class TagRoute {
    static initialize(app: Application) {
        app.get('/tags/recent', this.getRecentTags.bind(this));
    }

    private static async getRecentTags(_: Request, response: Response) {
        try {
            console.log('Request received: GET /tags/recent');

            const tags = await TagService.getRecent();
            response.status(200).send(tags);
        } catch (e) {
            console.log('Request failed: GET /tags/recent');
            console.error(e);
            response.status(500).send(e);
        }
    }
}