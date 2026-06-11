export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}

export interface EmailSender {
  send(email: TransactionalEmail): Promise<void>;
}
