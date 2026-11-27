#!/usr/bin/env node
/**
 * mint-license.mjs — Offline Ed25519 License Key Generator (v2.3.0)
 *
 * Generates a Ed25519 keypair, writes the public key (Base64) into
 * apps/web/src/state/licenseStore.ts (replacing the placeholder),
 * and prints a signed license key to stdout for distribution.
 *
 * Usage:
 *   node scripts/mint-license.mjs "Acme Engineering" "Jean Dupont" "Marie Martin" > license.txt
 *
 * The license payload contains:
 *   - tier: "pro"
 *   - firmName
 *   - engineerName
 *   - checkerName
 *   - issued: ISO date
 *   - nonce: 16 random bytes (prevents replay)
 *
 * Output format: RDM-PRO-<base64url(payload)>.<base64url(signature)>
 */

import { generateKeyPair, sign } from "node:crypto";
import { promisify } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const generateKeyPairAsync = promisify(generateKeyPair);
const signAsync = promisify(sign);

function base64url(bytes: Buffer): string {
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64(bytes: Buffer): string {
  return bytes.toString("base64");
}

async function main() {
  const [, , firmName, engineerName, checkerName] = process.argv;
  if (!firmName || !engineerName || !checkerName) {
    console.error("Usage: node scripts/mint-license.mjs <firmName> <engineerName> <checkerName>");
    process.exit(1);
  }

  // Generate Ed25519 keypair
  const { publicKey, privateKey } = await generateKeyPairAsync("ed25519");
  const publicKeyB64 = base64(publicKey);
  const privateKeyB64 = base64(privateKey);

  // Build payload
  const payload = {
    tier: "pro",
    firmName,
    engineerName,
    checkerName,
    issued: new Date().toISOString(),
    nonce: base64url(require("node:crypto").randomBytes(16)),
  };
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));

  // Sign payload
  const signature = await signAsync(null, Buffer.from(payloadB64), privateKey);
  const signatureB64 = base64url(signature);

  // License key
  const licenseKey = `RDM-PRO-${payloadB64}.${signatureB64}`;

  // Update licenseStore.ts with public key
  const licenseStorePath = resolve("apps/web/src/state/licenseStore.ts");
  let licenseStoreContent = readFileSync(licenseStorePath, "utf8");
  licenseStoreContent = licenseStoreContent.replace(
    'const LICENSE_PUBLIC_KEY_B64 = "RDM_STUDIO_PUBLIC_KEY_PLACEHOLDER";',
    `const LICENSE_PUBLIC_KEY_B64 = "${publicKeyB64}";`,
  );
  writeFileSync(licenseStorePath, licenseStoreContent);

  // Output
  console.log("# RDM Studio Pro License Key");
  console.log(`# Firm: ${firmName}`);
  console.log(`# Engineer: ${engineerName}`);
  console.log(`# Checker: ${checkerName}`);
  console.log(`# Issued: ${payload.issued}`);
  console.log(`# Public Key (Base64): ${publicKeyB64}`);
  console.log("");
  console.log(licenseKey);
  console.log("");
  console.log("# Private Key (Base64) — KEEP SECURE, DO NOT SHIP:");
  console.log(privateKeyB64);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});