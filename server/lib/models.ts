export class Id {
    _id: string;
}

export class Budget {
    weeklyAmount: number;
    lastWeekRemaining: number;
    transactions: Transaction[];
    
    constructor(initializer: Partial<Budget>) {
        Object.assign(this, initializer);
    }
}

export class Transaction extends Id {
    amount: number;
    date: Date;
    description: string;
    owner: string;
    ignored: boolean;

    static fromRaw(raw: any) : Transaction {
        const transaction = new Transaction();
        transaction._id = raw._id;
        transaction.amount = raw.amount;
        transaction.date = new Date(raw.date);
        transaction.description = raw.description;
        transaction.owner = raw.owner;
        transaction.ignored = raw.ignored;
        return transaction;
    }
}