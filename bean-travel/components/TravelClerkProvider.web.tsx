import { ClerkProvider } from "@clerk/clerk-react";
import React from "react";

type Props = {
  children: React.ReactNode;
  publishableKey: string;
  proxyUrl?: string;
};

export function TravelClerkProvider({ children, publishableKey }: Props) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  );
}
