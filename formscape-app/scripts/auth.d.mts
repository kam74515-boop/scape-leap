export function normalizeEmail(value: unknown): string;
export function validateEmail(value: unknown): boolean;
export function validatePassword(value: unknown): boolean;
export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, encoded: string): Promise<boolean>;
export function publicUser(user: Record<string, unknown>): {
  email: string;
  is_password_autoset: boolean;
  [key: string]: unknown;
};
