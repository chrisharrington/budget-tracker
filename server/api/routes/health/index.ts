import { Request, Response, Router } from 'express';

const router = Router();

// Cheap liveness probe: no Mongo, no auth, no async work — just confirms the process is up and
// serving. Container/uptime checks hit this instead of `/week`, which needs a valid date and a
// round-trip to Mongo.
router.get('/health', (_: Request, response: Response) => response.status(200).json({ status: 'ok' }));

export default router;
