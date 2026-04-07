export const DomainEvents = {
  CLIENT_DEACTIVATED: 'client.deactivated',
  CLIENT_REACTIVATED: 'client.reactivated',
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_DELETED: 'payment.deleted',
  IMPORT_COMPLETED: 'import.completed',
} as const;

export class ClientDeactivatedEvent {
  constructor(
    public readonly clientId: string,
    public readonly userId: string,
  ) {}
}

export class ClientReactivatedEvent {
  constructor(
    public readonly clientId: string,
    public readonly userId: string,
  ) {}
}

export class PaymentCreatedEvent {
  constructor(
    public readonly clientId: string,
    public readonly subscriptionId: string,
    public readonly year: number,
    public readonly month: number,
    public readonly userId: string,
  ) {}
}

export class PaymentDeletedEvent {
  constructor(
    public readonly clientId: string,
    public readonly subscriptionId: string,
    public readonly periodId: string,
    public readonly userId: string,
  ) {}
}

export class ImportCompletedEvent {
  constructor(
    public readonly tipo: string,
    public readonly validRows: number,
  ) {}
}
