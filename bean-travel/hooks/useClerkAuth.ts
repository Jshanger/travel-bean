import { useSignIn, useSignUp } from '@clerk/expo/legacy';

export function useSignInLegacy() {
  return useSignIn();
}

export function useSignUpLegacy() {
  return useSignUp();
}
