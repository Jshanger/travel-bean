export type SubscriptionPlan = 'free' | 'monthly' | 'yearly';

export interface UserPremiumState {
  isPremium: boolean;
  subscriptionPlan: SubscriptionPlan;
  beansCreatedThisMonth: number;
  monthlyBeanLimit: number;
  premiumSince: string | null;
  monthKey: string;
}

export const MONTHLY_BEAN_LIMIT = 5;

export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function defaultPremiumState(date = new Date()): UserPremiumState {
  return {
    isPremium: false,
    subscriptionPlan: 'free',
    beansCreatedThisMonth: 0,
    monthlyBeanLimit: MONTHLY_BEAN_LIMIT,
    premiumSince: null,
    monthKey: currentMonthKey(date),
  };
}

export function normalizePremiumState(value?: Partial<UserPremiumState> | null, date = new Date()): UserPremiumState {
  const fallback = defaultPremiumState(date);
  const monthKey = currentMonthKey(date);
  const sameMonth = value?.monthKey === monthKey;

  return {
    isPremium: value?.isPremium === true,
    subscriptionPlan: value?.subscriptionPlan ?? 'free',
    beansCreatedThisMonth: sameMonth ? value?.beansCreatedThisMonth ?? 0 : 0,
    monthlyBeanLimit: value?.monthlyBeanLimit ?? MONTHLY_BEAN_LIMIT,
    premiumSince: value?.premiumSince ?? null,
    monthKey,
  };
}

export function remainingFreeBeans(state: UserPremiumState) {
  return Math.max(0, state.monthlyBeanLimit - state.beansCreatedThisMonth);
}
