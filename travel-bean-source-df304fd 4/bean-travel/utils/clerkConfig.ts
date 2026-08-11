const DEFAULT_CLERK_PUBLISHABLE_KEY = 'pk_test_ZnVubnktb3JjYS0xOS5jbGVyay5hY2NvdW50cy5kZXYk';

export function getClerkPublishableKey() {
  return (
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY ||
    DEFAULT_CLERK_PUBLISHABLE_KEY
  );
}

export function hasClerkPublishableKey() {
  return Boolean(getClerkPublishableKey());
}

export function getClerkProxyUrl() {
  return process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;
}
