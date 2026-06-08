import dayjs from 'dayjs';
import { z } from 'zod';

// Request-validation schemas, one per route entry point. `z.object` strips unknown keys (so the
// app's client-only fields like a transaction `balance` are dropped rather than persisted), while the
// tag schema is loose (passthrough) to preserve any extra keys the app attaches to a tag.

const isValidDate = (value: string) => dayjs(value).isValid();

export const tagSchema = z.looseObject({
    _id: z.string().optional(),
    name: z.string(),
    ignore: z.boolean().default(false)
});

export const transactionSchema = z.object({
    _id: z.string(),
    amount: z.number(),
    date: z.coerce.date(),
    description: z.string(),
    owner: z.string(),
    ignored: z.boolean().default(false),
    tags: z.array(tagSchema).default([]),
    isAllowancePayment: z.boolean().optional()
});

export const transactionSplitSchema = z.object({
    transaction: transactionSchema,
    newAmount: z.number()
});

export const weekQuerySchema = z.object({
    date: z.string().refine(isValidDate, 'Invalid date.')
});

export const monthlyTagQuerySchema = z.object({
    start: z.string().refine(isValidDate, 'Invalid start date.'),
    end: z.string().refine(isValidDate, 'Invalid end date.'),
    tag: z.string().min(1)
});

export const deviceTokenSchema = z.object({
    token: z.string().min(1)
});
