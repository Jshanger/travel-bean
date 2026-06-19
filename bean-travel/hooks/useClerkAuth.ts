import { useAuth, useClerk } from '@clerk/expo';

export function useSignInLegacy() {
  const { isLoaded } = useAuth();
  const clerk = useClerk() as any;
  return {
    isLoaded,
    signIn: isLoaded ? (clerk.client?.signIn ?? null) : undefined,
    setActive: (params: { session: string | null }) => clerk.setActive(params),
  };
}

export function useSignUpLegacy() {
  const { isLoaded } = useAuth();
  const clerk = useClerk() as any;
  return {
    isLoaded,
    signUp: isLoaded ? (clerk.client?.signUp ?? null) : undefined,
    setActive: (params: { session: string | null }) => clerk.setActive(params),
  };
}
