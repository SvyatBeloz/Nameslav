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
      start_button: z.string().min(1),
      start_hint: z.string().min(1),
      share_button: z.string().min(1),
      share_copied: z.string().min(1),
      // Shown by window.prompt when the clipboard API is unavailable or denied.
      // This used to reuse `eyebrow` ("Сегодня ты —"), a caption that nothing
      // rendered — the key is gone now that it has a purpose-named replacement.
      copy_prompt: z.string().min(1),
      today_caption: z.string().min(1),
      reroll_hint: z.string().min(1),
      // Rendered into the page by the server, so the message survives even when
      // every /api/* fetch is what failed.
      load_error: z.string().min(1),
    }),
    share_page: z.object({
      heading: z.string().min(1),
      fallback_heading: z.string().min(1),
      // og:description for the fallback page. Separate from meta.og_description
      // because the fallback has no name to announce.
      fallback_og_description: z.string().min(1),
      view_caption: z.string().min(1),
      footnote: z.string().min(1),
      home_link: z.string().min(1),
    }),
    // Texts for the 404 / 500 pages. Express' built-in handlers answer in
    // English ("Cannot GET /x") and, with NODE_ENV unset, spill a stack trace
    // into the response body — so the app renders its own pages instead.
    errors: z.object({
      not_found_title: z.string().min(1),
      not_found_text: z.string().min(1),
      server_error_title: z.string().min(1),
      server_error_text: z.string().min(1),
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
