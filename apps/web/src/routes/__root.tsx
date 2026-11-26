import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useAppHotkeys } from "@/hooks/useAppHotkeys";
import { useFileOpening } from "@/hooks/useFileOpening";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { CommandPalette } from "@/components/CommandPalette";
import { LicenseModal } from "@/components/LicenseModal";

/**
 * Lean root (v2.1.0): the root route owns NOTHING layout-related — the
 * locked 100dvh CAD workstation chrome lives in the pathless `_studio`
 * layout, the editorial marketing chrome in the pathless `_marketing`
 * layout. The root only hosts the global overlay layer (toasts, ⌘K
 * palette, PWA update prompt, license modal) and the window-level file
 * opening + hotkey layers.
 */
function RootLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  useAppHotkeys(() => setPaletteOpen((open) => !open));
  // v1.4.0: drag-and-drop + PWA launchQueue file opening.
  useFileOpening();
  // v2.1.0: the license modal is a GLOBAL overlay — opened from the
  // marketing pricing section, the studio `EditionBadge` and the command
  // palette through the same window-event idiom as the onboarding tour.
  useEffect(() => {
    const openLicense = () => setLicenseOpen(true);
    const openPalette = () => setPaletteOpen(true);
    window.addEventListener("rdm-open-license", openLicense);
    window.addEventListener("rdm-open-palette", openPalette);
    // v2.2.0: the marketing site pricing CTAs deep-link into the studio with
    // `?license=pass|pro` — the LicenseModal opens straight away, keeping the
    // activation flow reachable even though `/` redirects to /geometry.
    const params = new URLSearchParams(window.location.search);
    if (params.has("license")) {
      setLicenseOpen(true);
    }
    return () => {
      window.removeEventListener("rdm-open-license", openLicense);
      window.removeEventListener("rdm-open-palette", openPalette);
    };
  }, []);

  return (
    <>
      <Outlet />
      <UpdatePrompt />
      {/* Sonner host: undo/what-if toasts fire from every step. */}
      <Toaster position="bottom-right" />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      {licenseOpen ? <LicenseModal onClose={() => setLicenseOpen(false)} /> : null}
    </>
  );
}

export const Route = createRootRoute({ component: RootLayout });
