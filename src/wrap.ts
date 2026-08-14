import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "v1:";

export function wrapSecretFromEnv(env: NodeJS.Dict<string> = process.env): string | undefined {
  const secret = env.WATCH_SECRET?.trim() || env.DASHBOARD_PASSWORD?.trim();
  return secret || undefined;
}

export function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update("wwatch-app-password-v1").update(secret).digest();
}

export function isWrapped(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function wrapPassword(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

export function unwrapPassword(stored: string, key: Buffer | null): string {
  if (!isWrapped(stored)) {
    return stored;
  }
  if (!key) {
    throw new Error("WATCH_SECRET or DASHBOARD_PASSWORD is required to read site credentials");
  }
  const parts = stored.slice(PREFIX.length).split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error("Could not decrypt site credentials");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[0], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[1], "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Could not decrypt site credentials. Check WATCH_SECRET.");
  }
}
