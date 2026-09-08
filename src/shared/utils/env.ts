/**
 * Environment access helpers.
 *
 * Secrets are read through requireEnv so that a missing value fails loudly at
 * the point of use, rather than falling back to a placeholder. A hardcoded
 * fallback is worse than a crash: it is committed to the repository, so it is
 * public, and it lets a misconfigured deployment come up looking healthy while
 * encrypting data or verifying signatures under a key everyone can read.
 */
export function requireEnv(key: string, hint?: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}.${hint ? ` ${hint}` : ""}`
    );
  }
  return value;
}
