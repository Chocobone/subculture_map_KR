import { useState, useEffect } from 'react';

export interface AuthUser { id: string; email: string; }

const BYPASS = import.meta.env.VITE_AUTH_BYPASS === 'true';

// Cognito 설정 (운영 환경)
const COGNITO_CONFIG = {
  userPoolId:  import.meta.env.VITE_COGNITO_USER_POOL_ID  ?? '',
  clientId:    import.meta.env.VITE_COGNITO_CLIENT_ID     ?? '',
  region:      import.meta.env.VITE_COGNITO_REGION        ?? 'ap-northeast-2',
};

const isCognitoConfigured = Boolean(
  COGNITO_CONFIG.userPoolId &&
  !COGNITO_CONFIG.userPoolId.includes('xxxxxxxxx') &&
  COGNITO_CONFIG.clientId &&
  !COGNITO_CONFIG.clientId.includes('xxxxxxxxx'),
);

export function useAuth(): {
  user:      AuthUser | null;
  isLoading: boolean;
  signIn:    (email: string, password: string) => Promise<void>;
  signOut:   () => Promise<void>;
} {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(!BYPASS);

  useEffect(() => {
    if (BYPASS) {
      setUser({ id: 'mock-user', email: 'dev@example.com' });
      return;
    }
    if (!isCognitoConfigured) {
      setIsLoading(false);
      return;
    }

    // Cognito 현재 세션 확인
    loadAmplifySession().then(u => { setUser(u); setIsLoading(false); });
  }, []);

  const signIn = async (email: string, password: string) => {
    if (BYPASS) return;
    if (!isCognitoConfigured) throw new Error('Cognito 미설정');
    const { signIn: amplifySignIn } = await import('aws-amplify/auth');
    await amplifySignIn({ username: email, password });
    const u = await loadAmplifySession();
    setUser(u);
  };

  const signOut = async () => {
    if (BYPASS) return;
    const { signOut: amplifySignOut } = await import('aws-amplify/auth');
    await amplifySignOut();
    setUser(null);
  };

  return { user, isLoading, signIn, signOut };
}

async function loadAmplifySession(): Promise<AuthUser | null> {
  try {
    const { Amplify }          = await import('aws-amplify');
    const { fetchAuthSession, fetchUserAttributes } = await import('aws-amplify/auth');

    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId:       COGNITO_CONFIG.userPoolId,
          userPoolClientId: COGNITO_CONFIG.clientId,
        },
      },
    });

    const session = await fetchAuthSession();
    if (!session.tokens?.idToken) return null;

    const attrs = await fetchUserAttributes();
    return {
      id:    attrs.sub   ?? '',
      email: attrs.email ?? '',
    };
  } catch {
    return null;
  }
}
