import { I18nProvider } from "@lingui/react";
import { i18n } from "../i18n/i18n";
import { ExpandablePanel, StatusBadge } from "@rdm-studio/ui/interior";

/**
 * FaqAccordion island (v2.2.0): the engineering FAQ on smooth
 * ExpandablePanels, ported verbatim from the v2.1.2 landing. The prerender
 * emits all answers server-side (crawlable HTML — the same array feeds the
 * FAQPage JSON-LD); hydration re-attaches the smooth disclosure.
 *
 * i18n: the island renders in its own React root (outside the layout's
 * `<I18nProvider>`), so it wraps itself in the provider over the shared
 * singleton. The `faq` props are already localized — `buildFaq()` resolves
 * them in the page's active locale at SSR time.
 */

export type FaqItem = { q: string; a: string; topic?: string };

export default function FaqAccordionIsland({ faq }: { faq: FaqItem[] }): React.ReactElement {
  return (
    <I18nProvider i18n={i18n}>
      <div className="divide-y divide-hairline border-t border-hairline">
        {faq.map((item) => (
          <ExpandablePanel
            key={item.q}
            title={
              <span className="flex items-center gap-2 text-[14px] font-medium text-ink-primary">
                {item.q}
                {item.topic && (
                  <StatusBadge tone="accent" mono className="shrink-0">
                    {item.topic}
                  </StatusBadge>
                )}
              </span>
            }
          >
            <p className="text-[13px] leading-6 text-ink-secondary">{item.a}</p>
          </ExpandablePanel>
        ))}
      </div>
    </I18nProvider>
  );
}
