import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import React from "react";

type Props = {
  children: React.ReactNode;
  publishableKey: string;
  proxyUrl?: string;
};

export function TravelClerkProvider({ children, publishableKey, proxyUrl }: Props) {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      {children}
    </ClerkProvider>
  );
}
