import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export interface PlaceInfo {
  placeUrl: string;
  placeLat: number;  // WGS84 위도
  placeLng: number;  // WGS84 경도
}

interface NaverLocalItem {
  link:  string;
  mapx:  string;  // 경도 × 1e7
  mapy:  string;  // 위도  × 1e7
}

let cachedCreds: { clientId: string; clientSecret: string } | null = null;

async function getCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
  // 로컬/SAM: 환경 변수 직접 사용
  if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
    return {
      clientId:     process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
    };
  }

  // AWS: Secrets Manager에서 로드 (Lambda 컨테이너 수명 동안 캐시)
  if (process.env.NAVER_SECRET_ARN) {
    if (cachedCreds) return cachedCreds;
    const sm = new SecretsManagerClient({ region: process.env.AWS_REGION });
    const { SecretString } = await sm.send(
      new GetSecretValueCommand({ SecretId: process.env.NAVER_SECRET_ARN }),
    );
    const secret = JSON.parse(SecretString!);
    cachedCreds = { clientId: secret.clientId, clientSecret: secret.clientSecret };
    return cachedCreds;
  }

  return null;
}

export async function searchPlace(placeName: string): Promise<PlaceInfo | null> {
  const creds = await getCredentials();
  if (!creds) return null;

  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(placeName)}&display=1`;

  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id':     creds.clientId,
      'X-Naver-Client-Secret': creds.clientSecret,
    },
  });

  if (!res.ok) return null;

  const data = await res.json() as { items: NaverLocalItem[] };
  const item = data.items?.[0];
  if (!item) return null;

  return {
    placeUrl: item.link,
    placeLat: Number(item.mapy) / 1e7,
    placeLng: Number(item.mapx) / 1e7,
  };
}
