import { Request, Response, Router } from 'express';

import * as TagService from '@lib/data/tags';
import { asyncHandler } from '@api/async-handler';

const router = Router();

async function getRecentTags(request: Request, response: Response) {
    request.log.info('Request received: GET /tags/recent');

    const tags = await TagService.getRecent();
    response.status(200).send(tags);
}

router.get('/tags/recent', asyncHandler(getRecentTags));

export default router;
