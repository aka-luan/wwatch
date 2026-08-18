import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";

const V1 = "v1:";
const V2 = "v2:";
const SALT_BYTES = 16;
/** scrypt at Node's defaults: ~100ms per derivation, which is why derived keys are cached. */
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_CACHE_CAP = 64;
const KEY_CACHE = new Map<string, Buffer>();

/**
 * Secrets that may unwrap a stored password, best first. WATCH_SECRET is the one new writes use;
 * DASHBOARD_PASSWORD stays in the list so a board that predates WATCH_SECRET keeps reading its
 * own rows until the store rewraps them.
 */
export function wrapSecretsFromEnv(env: NodeJS.Dict<string> = process.env): string[] {
  const out: string[] = [];
  for (const raw of [env.WATCH_SECRET, env.DASHBOARD_PASSWORD]) {
    const secret = raw?.trim();
    if (secret && !out.includes(secret)) {
      out.push(secret);
    }
  }
  return out;
}

export function isWrapped(stored: string): boolean {
  return stored.startsWith(V1) || stored.startsWith(V2);
}

/** True when the row is already sealed in the current format under the current secret. */
export function isCurrentWrap(stored: string, secret: string): boolean {
  if (!stored.startsWith(V2)) {
    return false;
  }
  try {
    unwrapPassword(stored, [secret]);
    return true;
  } catch {
    return false;
  }
}

export function wrapPassword(plain: string, secret: string): string {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", stretch(secret, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    V2 + salt.toString("base64url"),
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function unwrapPassword(stored: string, secrets: string[]): string {
  if (!isWrapped(stored)) {
    return stored;
  }
  if (secrets.length === 0) {
    throw new Error("WATCH_SECRET or DASHBOARD_PASSWORD is required to read site credentials");
  }
  const parts = stored.slice(V1.length).split(".");
  const legacy = stored.startsWith(V1);
  if (parts.length !== (legacy ? 3 : 4) || parts.some((part) => !part)) {
    throw new Error("Could not decrypt site credentials");
  }
  for (const secret of secrets) {
    const plain = legacy
      ? open(legacyKey(secret), parts[0], parts[1], parts[2])
      : open(stretch(secret, Buffer.from(parts[0] ?? "", "base64url")), parts[1], parts[2], parts[3]);
    if (plain !== null) {
      return plain;
    }
  }
  throw new Error("Could not decrypt site credentials. Check WATCH_SECRET.");
}

function open(key: Buffer, iv?: string, ciphertext?: string, tag?: string): string | null {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv ?? "", "base64url"));
    decipher.setAuthTag(Buffer.from(tag ?? "", "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext ?? "", "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function stretch(secret: string, salt: Buffer): Buffer {
  const cacheKey = createHash("sha256").update(secret).update(":").update(salt).digest("base64url");
  const hit = KEY_CACHE.get(cacheKey);
  if (hit) {
    return hit;
  }
  const key = scryptSync(secret, salt, 32, SCRYPT);
  if (KEY_CACHE.size >= KEY_CACHE_CAP) {
    KEY_CACHE.clear();
  }
  KEY_CACHE.set(cacheKey, key);
  return key;
}

/** v1 rows hashed the secret once with no salt. Read-only: nothing writes this format any more. */
function legacyKey(secret: string): Buffer {
  return createHash("sha256").update("wwatch-app-password-v1").update(secret).digest();
}
