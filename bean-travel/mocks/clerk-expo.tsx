import React from "react";

const previewUser = {
  primaryEmailAddress: {
    emailAddress: "preview@bean.travel",
  },
};

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function ClerkLoaded({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    getToken: async () => null,
    signOut: async () => undefined,
  };
}

export function useUser() {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: previewUser,
  };
}

export function useClerk() {
  return {
    client: {
      signIn: null,
      signUp: null,
    },
    setActive: async () => undefined,
  };
}

export function useSSO() {
  return {
    startSSOFlow: async () => ({ createdSessionId: null, setActive: null }),
  };
}
