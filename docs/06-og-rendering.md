# Рендер OG-картинок

Превью-картинки для мессенджеров и соцсетей рендерятся через [Takumi](https://takumi.kane.tw/) — движок на Rust, который превращает JSX прямо в PNG без headless-браузера. Пакет на npm называется `takumi-js` (просто «takumi» — это совсем другой, не относящийся к делу пакет).

## Контракт данных для шаблона

Любой OG-шаблон получает один и тот же набор пропсов и сам решает, что из них показать:

```ts
interface OgTemplateProps {
  id: string;             // стабильный id записи (для отладки/будущих шаблонов)
  name: string;
  hint: string;
  categoryTitle: string;
  categorySlug: string;
  date: string;           // уже отформатированная строка, см. 04-i18n.md
  domain: string;         // SITE_DOMAIN
}
```

Это позволяет добавлять новые шаблоны, трогая только `src/og/templates/` — рендерер (`src/og/renderer.ts`) не знает, как выглядит конкретный шаблон, он просто собирает `OgTemplateProps` из банка/локали/конфига и передаёт дальше через реестр `TEMPLATE_IDS → компонент` в `src/og/templates/registry.ts`. Сейчас есть один реальный шаблон, `whoami.tsx`.

## Кириллический шрифт

Имена в банке — кириллица («Куберслав»), а дефолтный встроенный шрифт Takumi (Geist) кириллицу не покрывает — без явной регистрации своего шрифта картинка превратилась бы в квадраты-тофу вместо текста. Поэтому при старте `src/og/renderer.ts` один раз регистрирует Noto Sans (Regular + Bold, лицензия OFL, файлы лежат в `public/assets/fonts/`) на persistent-инстансе `Renderer` — это происходит до того, как сервер начинает принимать трафик:

```ts
export const ogRendererReady = (async () => {
  const regular = readFileSync(join(FONTS_DIR, "NotoSans-Regular.ttf"));
  const bold = readFileSync(join(FONTS_DIR, "NotoSans-Bold.ttf"));
  await renderer.registerFont({ name: "NotoSansOG", data: regular, weight: 400 });
  await renderer.registerFont({ name: "NotoSansOG", data: bold, weight: 700 });
})();
```

Шаблон `whoami.tsx` использует этот шрифт через `style={{ fontFamily: "NotoSansOG" }}` и стилизуется Tailwind-подобными классами через проп `tw` — Takumi поддерживает это из коробки, без реального Tailwind и шага сборки.

## Кэш дневной картинки

`src/og/dailyImageCache.ts` кэширует на диск только анонимную картинку «имени дня» (`/og-image.png`) — один файл на календарную дату, переиспользуется в течение суток. Картинки для share-ссылок этот кэш не использует — они рендерятся заново на каждый запрос, см. [`03-share-link.md`](./03-share-link.md).
