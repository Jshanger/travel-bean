import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { type PurchasesOfferings, type CustomerInfo } from 'react-native-purchases';
import { useMutation, useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';

const TEST_KEY    = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const IOS_KEY     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_ID = 'pro';

let revenueCatConfigured = false;

function getApiKey(): string | null {
  if (__DEV__ || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
    return TEST_KEY ?? null;
  }
  if (Platform.OS === 'ios') return IOS_KEY ?? null;
  if (Platform.OS === 'android') return ANDROID_KEY ?? null;
  return TEST_KEY ?? null;
}

export function initializeRevenueCat(): boolean {
  if (revenueCatConfigured) return true;
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('RevenueCat is unavailable because its API key is not configured.');
    return false;
  }

  try {
    Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN);
    Purchases.configure({ apiKey });
    revenueCatConfigured = true;
    return true;
  } catch (error) {
    console.warn('RevenueCat initialization failed. Premium purchases are temporarily unavailable.', error);
    return false;
  }
}

function useSubscriptionContext() {
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    setIsConfigured(initializeRevenueCat());
  }, []);

  const customerInfoQuery = useQuery<CustomerInfo>({
    queryKey: ['revenuecat', 'customer-info'],
    queryFn: () => Purchases.getCustomerInfo(),
    staleTime: 60 * 1000,
    enabled: isConfigured,
    retry: false,
  });

  const offeringsQuery = useQuery<PurchasesOfferings>({
    queryKey: ['revenuecat', 'offerings'],
    queryFn: () => Purchases.getOfferings(),
    staleTime: 300 * 1000,
    enabled: isConfigured,
    retry: false,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: any) => {
      if (!isConfigured) throw new Error('Premium purchases are temporarily unavailable.');
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: () => {
      if (!isConfigured) throw new Error('Premium purchases are temporarily unavailable.');
      return Purchases.restorePurchases();
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const refetchCustomerInfo = useCallback(async () => {
    if (!isConfigured) return undefined;
    return customerInfoQuery.refetch();
  }, [customerInfoQuery, isConfigured]);

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_ID] !== undefined;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    isSubscribed,
    isConfigured,
    isLoading: isConfigured && (customerInfoQuery.isLoading || offeringsQuery.isLoading),
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    refetchCustomerInfo,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
