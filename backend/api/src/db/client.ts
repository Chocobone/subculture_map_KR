import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let pool: Pool;

export async function getPool(): Promise<Pool> {
  if (pool) return pool;

  if (process.env.DB_PASSWORD) {
    // 로컬 개발: 환경 변수 직접 사용
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
    // AWS 환경: Secrets Manager에서 크리덴셜 로드
    const sm = new SecretsManagerClient({ region: process.env.AWS_REGION });
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
