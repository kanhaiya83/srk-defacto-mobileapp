import Constants from 'expo-constants';

/**
 * API base URL.
 *
 * `EXPO_PUBLIC_API_URL` is inlined at build time (and therefore public — never
 * put a secret here). The `extra.apiUrl` fallback lets a build channel override
 * it from app.json without touching code.
 */
const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || fromExtra || 'https://defacto.srk.aws.heykanhaiya.xyz';
