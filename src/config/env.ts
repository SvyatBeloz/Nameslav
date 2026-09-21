import { config as loadDotenv } from "dotenv";
import { parseFingerprintFields, type FingerprintField } from "./fingerprintFields.js";
import { parsePort } from "./port.js";

// OS-level env vars already set take priority; .env only fills in what's missing
// (dotenv's default behavior — no extra branching needed).
loadDotenv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Обязательная переменная окружения не задана: ${name}`);
  }
  return value;
}

export interface Env {
  siteDomain: string;
  port: number;
  nodeEnv: string;
  fingerprintSalt: string;
  fingerprintFields: FingerprintField[];
}

export const env: Env = {
  siteDomain: requireEnv("SITE_DOMAIN"),
  port: parsePort(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV ?? "production",
  fingerprintSalt: process.env.FINGERPRINT_SALT ?? "nameslav-default-salt",
  fingerprintFields: parseFingerprintFields(process.env.FINGERPRINT_FIELDS),
};
