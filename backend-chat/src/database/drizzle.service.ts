import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2/promise';
import * as schema from './schema';

export type DrizzleDB = MySql2Database<typeof schema>;

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private pool: mysql.Pool;
  public db: DrizzleDB;

  async onModuleInit() {
    this.pool = mysql.createPool({
      uri: process.env.DATABASE_URL!,
      waitForConnections: true,
      connectionLimit: 10,
    });

    this.db = drizzle(this.pool, { schema, mode: 'default' });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
