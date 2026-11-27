import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Local-first commercial license store (v2.3.0): Offline Pro tier + firm
 * branding with signed license keys (Ed25519), persisted in localStorage
 * (never a server — the zero-cloud GDPR stance is part of the product).
 * Step 5's ReportBuilder cover metadata pre-fills from this store.
 */

export type LicenseTier = "free" | "pro";

export interface LicenseState {
  tier: LicenseTier;
  /** `RDM-PRO-<payload>.<signature>` key (offline Ed25519 signature check). */
  licenseKey: string | null;
  /** Firm branding pre-filled into the A4 / .docx report cover. */
  firmName: string;
  engineerName: string;
  checkerName: string;
  /** Validates the `RDM-PRO-` prefix, Ed25519 signature, and activates the Pro tier. */
  activateKey: (key: string) => Promise<{ ok: boolean; error?: string }>;
  /** 1-click demonstration Pro (evaluation, no key required). */
  activateDemoPro: () => void;
  resetToFree: () => void;
}

/** Ed25519 public key (Base64) — shipped with the app for offline verification. */
const LICENSE_PUBLIC_KEY_B64 = "RDM_STUDIO_PUBLIC_KEY_PLACEHOLDER"; // Replaced at build by mint-license.mjs
const LICENSE_PREFIX = "RDM-PRO-";

/** Verify Ed25519 signature offline (Web Crypto API). */
async function verifyLicenseSignature(key: string): Promise<boolean> {
  try {
    const parts = key.split(".");
    if (parts.length !== 2) return false;
    const [payload, signatureB64] = parts as [string, string];
    const publicKey = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(atob(LICENSE_PUBLIC_KEY_B64), (c) => c.charCodeAt(0)),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const signature = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const data = new TextEncoder().encode(payload);
    return await crypto.subtle.verify("Ed25519", publicKey, signature, data);
  } catch {
    return false;
  }
}

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set) => ({
      tier: "free",
      licenseKey: null,
      firmName: "",
      engineerName: "",
      checkerName: "",
      activateKey: async (key) => {
        const trimmed = key.trim();
        if (!trimmed.startsWith(LICENSE_PREFIX)) {
          return { ok: false, error: "invalid-prefix" };
        }
        if (trimmed.length < LICENSE_PREFIX.length + 16) {
          return { ok: false, error: "key-too-short" };
        }
        const valid = await verifyLicenseSignature(trimmed);
        if (!valid) {
          return { ok: false, error: "invalid-signature" };
        }
        set({ tier: "pro", licenseKey: trimmed });
        return { ok: true };
      },
      activateDemoPro: () => {
        set({ tier: "pro", licenseKey: `${LICENSE_PREFIX}DEMO` });
      },
      resetToFree: () =>
        set({ tier: "free", licenseKey: null, firmName: "", engineerName: "", checkerName: "" }),
    }),
    { name: "rdm-license" },
  ),
);
