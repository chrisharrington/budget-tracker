export class Id {
    _id: string;
}

export class BudgetItem extends Id {
    amount: number;
    date: Date;
    description: string;
    owner: string;
}