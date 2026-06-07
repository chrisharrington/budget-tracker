import { Application, Request, Response } from 'express';

import TagService from '@lib/data/tags';


export default class TagRoute {
    static initialize(app: Application) {
        app.get('/tags/recent', this.getRecentTags.bind(this));
    }

    private static async getRecentTags(request: Request, response: Response) {
        try {
            request.log.info('Request received: GET /tags/recent');

            const tags = await TagService.getRecent();
            response.status(200).send(tags);
        } catch (e) {
            request.log.error({ err: e }, 'Request failed: GET /tags/recent');
            response.status(500).send(e);
        }
    }
}