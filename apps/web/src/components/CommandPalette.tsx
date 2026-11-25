import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Trans } from "@lingui/react/macro";

/**
 * Keyboard-first command palette (DESIGN.md §6, `cmdk` 1.1.1): instant
 * access to the 5 steps, profile presets and exports. Opens with ⌘K / Ctrl+K.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }
  const go = (to: string) => {
    onOpenChange(false);
    void navigate({ to });
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-primary/20 p-4 pt-[12vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-hairline bg-panel shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Palette de commandes">
          <div className="border-b border-hairline p-2">
            <Command.Input
              autoFocus
              placeholder="Rechercher une étape, un profil, une action…"
              className="w-full rounded bg-transparent px-2 py-1.5 text-[13px] outline-none"
            />
          </div>
          <Command.List className="max-h-72 overflow-auto p-1">
            <Command.Empty className="p-3 text-[12px] text-ink-muted">
              <Trans>Aucun résultat.</Trans>
            </Command.Empty>
            <Command.Group heading="Étapes" className="p-2 text-[13px]">
              {[
                { to: "/geometry", label: "Géométrie & Profilés" },
                { to: "/supports", label: "Liaisons (RDM 7)" },
                { to: "/loads", label: "Charges & Combinaisons" },
                { to: "/results", label: "Calcul 3D & Eurocode 3" },
                { to: "/report", label: "Rapport" },
              ].map((item) => (
                <Command.Item
                  key={item.to}
                  value={item.label}
                  onSelect={() => go(item.to)}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
                >
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Profils" className="p-2 text-[13px]">
              {["IPE 200", "IPE 240", "IPE 300", "HEA 200", "HEB 300"].map((p) => (
                <Command.Item
                  key={p}
                  value={p}
                  onSelect={() => {
                    onOpenChange(false);
                    void navigate({ to: "/geometry" });
                  }}
                  className="font-data flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
                >
                  {p}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Exports" className="p-2 text-[13px]">
              <Command.Item
                value="Rapport PDF"
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: "/report" });
                }}
                className="cursor-pointer rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
              >
                Rapport PDF
              </Command.Item>
              <Command.Item
                value="Resultats CSV"
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: "/report" });
                }}
                className="cursor-pointer rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
              >
                Résultats CSV
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
