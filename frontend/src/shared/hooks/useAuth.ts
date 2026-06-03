const BYPASS = import.meta.env.VITE_AUTH_BYPASS === 'true';

export interface AuthUser { id: string; email: string; }

export function useAuth(): { user: AuthUser | null; isLoading: boolean } {
  if (BYPASS) {
    return { user: { id: 'mock-user', email: 'dev@example.com' }, isLoading: false };
  }
  // TODO: AWS Amplify fetchAuthSession() 연동 (배포 환경)
  return { user: null, isLoading: false };
}
