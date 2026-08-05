/**
 * Password policy, mirroring the server's `passwordSchema` in
 * `validators/common.validators.ts`.
 *
 * Kept in its own module (not alongside the component that renders it) so both
 * can be imported without tripping React Fast Refresh, which requires component
 * files to export only components.
 *
 * If the server policy changes, change it here too — the server remains the
 * enforcing side; this only gives immediate feedback.
 */
export const PASSWORD_RULES = [
  { label: "At least 10 characters", test: (v: string) => v.length >= 10 },
  { label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One number", test: (v: string) => /[0-9]/.test(v) },
  { label: "One special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export const isPasswordValid = (value: string): boolean =>
  PASSWORD_RULES.every((rule) => rule.test(value));
