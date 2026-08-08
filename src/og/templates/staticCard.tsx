const FONT_FAMILY = "NotoSansOG";

/**
 * Props of the root-page branding card. Deliberately NOT OgTemplateProps:
 * the card describes the service as a whole, so it has no name/category/date.
 */
export interface StaticOgCardProps {
  title: string;
  description: string;
  domain: string;
}

/**
 * Static "about the service" card for the root-page preview. Social crawlers
 * cache OG images for a long time, so per-day content there would go stale —
 * the card is intentionally date-free (see docs/06-og-rendering.md).
 */
export function StaticOgCard(props: StaticOgCardProps) {
  return (
    <div
      tw="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-700"
      style={{ fontFamily: FONT_FAMILY }}
    >
      <div tw="text-7xl font-bold text-white mb-8">{props.title}</div>
      <div tw="text-3xl text-slate-200 text-center px-24">{props.description}</div>
      <div tw="text-xl text-slate-400 mt-12">{props.domain}</div>
    </div>
  );
}
