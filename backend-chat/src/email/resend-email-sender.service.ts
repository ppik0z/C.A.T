import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import type { EmailSender, TransactionalEmail } from './email-sender';

@Injectable()
export class ResendEmailSender implements EmailSender {
  private client: Resend | null = null;

  async send(email: TransactionalEmail): Promise<void> {
    const response = await this.getClient().emails.send(
      {
        from: this.getRequiredEnvironmentValue('RESEND_FROM_EMAIL'),
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      },
      email.idempotencyKey
        ? { idempotencyKey: email.idempotencyKey }
        : undefined,
    );

    if (response.error) {
      throw new Error(`Resend rejected the email: ${response.error.name}`);
    }
  }

  private getClient() {
    if (!this.client) {
      this.client = new Resend(
        this.getRequiredEnvironmentValue('RESEND_API_KEY'),
      );
    }
    return this.client;
  }

  private getRequiredEnvironmentValue(
    name: 'RESEND_API_KEY' | 'RESEND_FROM_EMAIL',
  ) {
    const value = process.env[name]?.trim();
    if (!value)
      throw new Error(`${name} is required to send transactional emails.`);
    return value;
  }
}
