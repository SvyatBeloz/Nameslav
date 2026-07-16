import type { OgTemplateProps } from "./registry.js";

const FONT_FAMILY = "NotoSansOG";

export function WhoamiTemplate(props: OgTemplateProps) {
  return (
    <div
      tw="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-700"
      style={{ fontFamily: FONT_FAMILY }}
    >
      <div tw="text-3xl text-slate-300 mb-6">
        {props.date} · #{props.categorySlug}
      </div>
      <div tw="text-8xl font-bold text-white mb-8">{props.name}</div>
      <div tw="text-3xl text-slate-200 text-center px-24">{props.hint}</div>
      <div tw="text-xl text-slate-400 mt-12">{props.domain}</div>
    </div>
  );
}
