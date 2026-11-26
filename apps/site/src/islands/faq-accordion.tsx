import { ExpandablePanel } from "../components/interior";

/**
 * FaqAccordion island (v2.2.0): the engineering FAQ on smooth
 * ExpandablePanels, ported verbatim from the v2.1.2 landing. The prerender
 * emits all answers server-side (crawlable HTML — the same array feeds the
 * FAQPage JSON-LD); hydration re-attaches the smooth disclosure.
 */

export type FaqItem = { q: string; a: string };

export default function FaqAccordionIsland({ faq }: { faq: FaqItem[] }): React.ReactElement {
  return (
    <div className="divide-y divide-hairline border-t border-hairline">
      {faq.map((item) => (
        <ExpandablePanel
          key={item.q}
          title={<span className="text-[14px] font-medium text-ink-primary">{item.q}</span>}
        >
          <p className="text-[13px] leading-6 text-ink-secondary">{item.a}</p>
        </ExpandablePanel>
      ))}
    </div>
  );
}
