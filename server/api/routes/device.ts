import { Request, Response, Router } from 'express';

import * as DeviceService from '@lib/data/device';
import { parseDevice } from '@lib/parse';
import { asyncHandler } from '@api/async-handler';

const router = Router();

async function upsertDevice(request: Request, response: Response) {
    request.log.info('Request received: POST /device');
    await DeviceService.upsert(parseDevice(request.body));
    request.log.info(`Registered device with token ${request.body.token}`);

    response.sendStatus(200);
}

router.post('/device', asyncHandler(upsertDevice));

export default router;
