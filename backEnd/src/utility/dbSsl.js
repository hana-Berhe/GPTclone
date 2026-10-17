import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The backEnd folder, so DB_SSL_CA_FILE=./ca.pem works from any working directory
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Cloud databases (Aiven) need SSL with their CA certificate. A local database doesn't.
// The certificate can be a file (DB_SSL_CA_FILE) or the text itself (DB_SSL_CA).
export function buildDbSslOptions(env) {
  if (env.DB_SSL?.trim().toLowerCase() !== "true") return undefined;

  let ca;
  if (env.DB_SSL_CA_FILE?.trim()) {
    ca = fs.readFileSync(path.resolve(backendRoot, env.DB_SSL_CA_FILE.trim()), "utf8");
  } else {
    // Dashboards often store line breaks as "\n", so turn them back into real ones
    ca = env.DB_SSL_CA?.replace(/\\n/g, "\n");
  }

  if (!ca?.includes("BEGIN CERTIFICATE")) {
    throw new Error("DB_SSL is true, so set DB_SSL_CA_FILE or DB_SSL_CA to the CA certificate.");
  }
  return { ca: ca.replace(/\r\n/g, "\n").trim(), rejectUnauthorized: true };
}
