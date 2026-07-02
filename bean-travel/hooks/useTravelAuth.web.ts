import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { hasClerkPublishableKey } from "@/utils/clerkConfig";

const clerkConfigured = hasClerkPublishableKey();

const fallbackAuth = {
  isLoaded: true,
  isSignedIn: false,
  getToken: async () => null,
  signOut: async () => undefined,
};

const fallbackUser = {
  isLoaded: true,
  isSignedIn: false,
  user: null,
};

const fallbackClerk = {
  handleRedirectCallback: async (
    _options?: unknown,
    navigate?: (to: string) => void,
  ) => {
    navigate?.("/blog");
  },
};

export function useTravelAuth() {
  if (!clerkConfigured) return fallbackAuth;

  try {
    return useAuth();
  } catch {
    return fallbackAuth;
  }
}

export function useTravelUser() {
  if (!clerkConfigured) return fallbackUser;

  try {
    return useUser();
  } catch {
    return fallbackUser;
  }
}

export function useTravelClerk() {
  if (!clerkConfigured) return fallbackClerk;

  try {
    return useClerk();
  } catch {
    return fallbackClerk;
  }
}
