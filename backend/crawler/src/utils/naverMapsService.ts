import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

export interface PlaceInfo {
  placeUrl: string | null;
  placeLat: number;
  placeLng: number;
}

interface NaverLocalItem {
  link: string;
  mapx: string;
  mapy: string;
}

interface NcpAddress {
  x: string;
  y: string;
}

let cachedNaverCreds: { clientId: string; clientSecret: string } | null = null;
let cachedNcpCreds:   { clientId: string; clientSecret: string } | null = null;

async function getNaverCreds(): Promise<{ clientId: string; clientSecret: string } | null> {
  if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
    return { clientId: process.env.NAVER_CLIENT_ID, clientSecret: process.env.NAVER_CLIENT_SECRET };
  }
  if (process.env.NAVER_PARAM_PATH) {
    if (cachedNaverCreds) return cachedNaverCreds;
    const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    const { Parameter } = await ssm.send(new GetParameterCommand({
      Name: process.env.NAVER_PARAM_PATH, WithDecryption: true,
    }));
    const s = JSON.parse(Parameter!.Value!);
    cachedNaverCreds = { clientId: s.clientId, clientSecret: s.clientSecret };
    return cachedNaverCreds;
  }
  if (process.env.NAVER_SECRET_ARN) {
    if (cachedNaverCreds) return cachedNaverCreds;
    const sm = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: process.env.NAVER_SECRET_ARN }));
    const s = JSON.parse(SecretString!);
    cachedNaverCreds = { clientId: s.clientId, clientSecret: s.clientSecret };
    return cachedNaverCreds;
  }
  return null;
}

async function getNcpCreds(): Promise<{ clientId: string; clientSecret: string } | null> {
  if (process.env.NCP_CLIENT_ID && process.env.NCP_CLIENT_SECRET) {
    return { clientId: process.env.NCP_CLIENT_ID, clientSecret: process.env.NCP_CLIENT_SECRET };
  }
  if (process.env.NCP_PARAM_PATH) {
    if (cachedNcpCreds) return cachedNcpCreds;
    const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    const { Parameter } = await ssm.send(new GetParameterCommand({
      Name: process.env.NCP_PARAM_PATH, WithDecryption: true,
    }));
    const s = JSON.parse(Parameter!.Value!);
    cachedNcpCreds = { clientId: s.clientId, clientSecret: s.clientSecret };
    return cachedNcpCreds;
  }
  if (process.env.NCP_SECRET_ARN) {
    if (cachedNcpCreds) return cachedNcpCreds;
    const sm = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: process.env.NCP_SECRET_ARN }));
    const s = JSON.parse(SecretString!);
    cachedNcpCreds = { clientId: s.clientId, clientSecret: s.clientSecret };
    return cachedNcpCreds;
  }
  return null;
}

async function geocodeNcp(query: string): Promise<PlaceInfo | null> {
  const creds = await getNcpCreds();
  if (!creds) return null;

  const res = await fetch(
    `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
    {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': creds.clientId,
        'X-NCP-APIGW-API-KEY':    creds.clientSecret,
      },
    },
  );
  if (!res.ok) return null;

  const data = await res.json() as { addresses: NcpAddress[] };
  const addr = data.addresses?.[0];
  if (!addr) return null;

  return { placeUrl: null, placeLat: Number(addr.y), placeLng: Number(addr.x) };
}

async function searchPlaceNaver(placeName: string): Promise<PlaceInfo | null> {
  const creds = await getNaverCreds();
  if (!creds) return null;

  const res = await fetch(
    `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(placeName)}&display=1`,
    {
      headers: {
        'X-Naver-Client-Id':     creds.clientId,
        'X-Naver-Client-Secret': creds.clientSecret,
      },
    },
  );
  if (!res.ok) return null;

  const data = await res.json() as { items: NaverLocalItem[] };
  const item = data.items?.[0];
  if (!item) return null;

  return {
    placeUrl: item.link || null,
    placeLat: Number(item.mapy) / 1e7,
    placeLng: Number(item.mapx) / 1e7,
  };
}

/**
 * 장소명 또는 주소로 좌표를 조회한다.
 * 우선순위: NCP Geocoding → Naver Local Search
 */
export async function searchPlace(query: string): Promise<PlaceInfo | null> {
  if (!query) return null;
  return (await geocodeNcp(query)) ?? (await searchPlaceNaver(query));
}
