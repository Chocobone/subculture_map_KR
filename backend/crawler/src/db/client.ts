import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let pool: Pool;

export async function getPool(): Promise<Pool> {
  if (pool) return pool;

  if (process.env.DB_PASSWORD) {
    pool = new Pool({
      host:              process.env.DB_HOST,
      port:              Number(process.env.DB_PORT ?? 5432),
      database:          process.env.DB_NAME,
      user:              process.env.DB_USER,
      password:          process.env.DB_PASSWORD,
      max:               5,
      idleTimeoutMillis: 10_000,
    });
  } else {
    const sm = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    const { SecretString } = await sm.send(
      new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN! }),
    );
    const secret = JSON.parse(SecretString!);
    pool = new Pool({
      host:              process.env.DB_HOST,
      database:          process.env.DB_NAME,
      user:              secret.username,
      password:          secret.password,
      max:               5,
      idleTimeoutMillis: 10_000,
    });
  }

  return pool;
}
