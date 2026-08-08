import { z } from "zod";

const DATE_STYLES = ["full", "long", "medium", "short"] as const;

export const LocaleSchema = z
  .object({
    locale_code: z.string().min(1),
    date_style: z.enum(DATE_STYLES),
    meta: z.object({
      site_title: z.string().min(1),
      // Generic, name-independent service description for the static root
      // preview (og:description on `/`). og_description below is the
      // per-name one ("Today you are — {{name}}"), used on share pages.
      site_description: z.string().min(1),
      og_description: z.string().min(1),
    }),
    home: z.object({
      eyebrow: z.string().min(1),
      start_hint: z.string().min(1),
      share_button: z.string().min(1),
      reroll_hint: z.string().min(1),
    }),
    share_page: z.object({
      heading: z.string().min(1),
      fallback_heading: z.string().min(1),
      home_link: z.string().min(1),
    }),
  })
  .superRefine((locale, ctx) => {
    try {
      new Intl.DateTimeFormat(locale.locale_code);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["locale_code"],
        message: `Невалидный BCP 47 locale_code: "${locale.locale_code}"`,
      });
    }
  });

export type LocaleConfig = z.infer<typeof LocaleSchema>;
