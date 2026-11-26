import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Local-first commercial license store (v2.1.0): Offline Pro tier + firm
 * branding, persisted in localStorage (never a server — the zero-cloud
 * GDPR stance is part of the product). Step 5's ReportBuilder cover
 * metadata pre-fills from this store.
 */

export type LicenseTier = "free" | "pro";

export interface LicenseState {
  tier: LicenseTier;
  /** `RDM-PRO-…` key (never validated online — offline signature check). */
  licenseKey: string | null;
  /** Firm branding pre-filled into the A4 / .docx report cover. */
  firmName: string;
  engineerName: string;
  checkerName: string;
  /** Validates the `RDM-PRO-` prefix and activates the Pro tier. */
  activateKey: (key: string) => { ok: boolean; error?: string };
  /** 1-click demonstration Pro (evaluation, no key required). */
  activateDemoPro: () => void;
  resetToFree: () => void;
}

const LICENSE_PREFIX = "RDM-PRO-";

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set) => ({
      tier: "free",
      licenseKey: null,
      firmName: "",
      engineerName: "",
      checkerName: "",
      activateKey: (key) => {
        const trimmed = key.trim();
        if (!trimmed.startsWith(LICENSE_PREFIX)) {
          return { ok: false, error: "invalid-prefix" };
        }
        if (trimmed.length < LICENSE_PREFIX.length + 8) {
          return { ok: false, error: "key-too-short" };
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
