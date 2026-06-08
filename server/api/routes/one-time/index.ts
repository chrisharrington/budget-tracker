import { Request, Response, Router } from 'express';

import * as OneTimeService from '@lib/data/one-time';
import { asyncHandler } from '@api/async-handler';

const router = Router();

async function getOneTimeBalance(request: Request, response: Response) {
    request.log.info('Request received: GET /one-time/balance');

    const oneTime = await OneTimeService.get();
    response.status(200).send(JSON.stringify(oneTime));
}

router.get('/one-time/balance', asyncHandler(getOneTimeBalance));

export default router;
