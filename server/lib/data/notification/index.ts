import { NotificationTicket } from '@lib/models';

import { collection } from '@lib/data/base';

const notifications = () => collection<NotificationTicket>('notifications');

// Persists Expo push tickets so the receipt-acquisition cron can later reconcile them against
// delivery receipts. Each ticket carries the token it was sent to, so a `DeviceNotRegistered`
// receipt (which is keyed only by receipt id) can be traced back to the device to disable.
export async function insert(tickets: Omit<NotificationTicket, '_id'>[]): Promise<void> {
    if (!tickets.length)
        return;

    const collection = await notifications();
    await collection.insertMany(tickets as NotificationTicket[]);
}

// Tickets still awaiting a delivery receipt.
export async function listUnacquired(): Promise<NotificationTicket[]> {
    const collection = await notifications();
    return await collection.find({ receiptAcquired: false }).toArray() as NotificationTicket[];
}

// Marks the named tickets (by Expo receipt id) as reconciled. Receipts that aren't ready yet are
// simply never passed here, so they stay pending for the next run.
export async function markAcquired(notificationIds: string[]): Promise<void> {
    if (!notificationIds.length)
        return;

    const collection = await notifications();
    await collection.updateMany(
        { notificationId: { $in: notificationIds } },
        { $set: { receiptAcquired: true } }
    );
}
