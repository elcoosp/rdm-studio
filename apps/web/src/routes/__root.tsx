import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { ModalVibration, SectionCut, SteelJointIcon, SupportPinned } from "@rdm-studio/ui/icons";
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
 * opening hook.
 */
function RootLayout() {
  useAppHotkeys(() => setPaletteOpen((open) => !open));
  useFileOpening();
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const openLicense = () => setLicenseOpen(true);
    const openPalette = () => setPaletteOpen(true);
    window.addEventListener("rdm-open-license", openLicense);
    window.addEventListener("rdm-open-palette", openPalette);
    if (window.location.hash === "#license") {
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
      {/* Swiss Metrology Sonner host: positioned top-center below the 48px
          header so it never overlaps the bottom-right XYZ triad or status bar,
          with custom structural engineering icons per severity. */}
      <Toaster
        position="top-center"
        offset={54}
        gap={6}
        icons={{
          success: (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-emerald-500/10 text-emerald-600">
              <SteelJointIcon size={15} />
            </span>
          ),
          info: (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-accent-tint text-accent">
              <SupportPinned size={15} />
            </span>
          ),
          warning: (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-amber-500/10 text-amber-600">
              <ModalVibration size={15} />
            </span>
          ),
          error: (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-fea-max/10 text-fea-max">
              <SectionCut size={15} />
            </span>
          ),
        }}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "flex w-auto max-w-[440px] items-center gap-2.5 rounded-[6px] border border-hairline bg-panel/95 px-3 py-2 text-[12px] text-ink-primary shadow-[0_6px_20px_rgba(15,23,42,0.08)] backdrop-blur-xs",
            title: "font-medium leading-4 text-ink-primary",
            description: "font-data mt-0.5 text-[11px] leading-4 text-ink-muted",
            actionButton:
              "ml-2 shrink-0 rounded-[4px] border border-accent-ring bg-accent-tint px-2 py-0.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent hover:text-white",
            cancelButton:
              "ml-1 shrink-0 rounded-[4px] border border-hairline bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-secondary hover:text-ink-primary",
          },
        }}
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      {licenseOpen ? <LicenseModal onClose={() => setLicenseOpen(false)} /> : null}
    </>
  );
}

export const Route = createRootRoute({ component: RootLayout });
