# Структура репозитория

```
Nameslav/
├── Dockerfile, docker-compose.yml, .dockerignore    # см. 08-deployment.md
├── .env.example
├── package.json, tsconfig.json
├── README.md
│
├── docs/                        # эти документы
│
├── public/                      # статика фронтенда — отдаётся express.static, без сборки
│   ├── index.html               # шаблон главной: home-роут подставляет OG-мету (см. 07-routes.md)
│   ├── favicon.ico
│   └── assets/
│       ├── style.css
│       ├── script.js            # оркестрация: fetch конфигов, фингерпринт, выбор имени, анимация
│       ├── config.js            # fetch('/api/config.json') один раз, кэширует результат
│       ├── fingerprint.js        # сбор браузерных сигналов
│       ├── selectorMath.js        # зеркало src/names/selector.ts (Web Crypto вместо node:crypto)
│       └── fonts/                 # Noto Sans — кириллический шрифт для OG-картинок
│
└── src/
    ├── server.ts                 # точка входа: конфиг → банк → локаль → шрифты → роуты → listen
    │
    ├── config/
    │   ├── env.ts                 # переменные окружения, typed-конфиг
    │   └── fingerprintFields.ts     # реестр допустимых сигналов фингерпринта
    │
    ├── names/                       # см. 01-name-bank.md, 02-selector.md
    │   ├── bank/*.yaml
    │   ├── bankLoader.ts, bankValidator.ts, schema.ts, roles.ts
    │   └── selector.ts
    │
    ├── i18n/                          # см. 04-i18n.md
    │   ├── locale.yaml, locale.example-en.yaml
    │   └── schema.ts, loader.ts
    │
    ├── og/                              # см. 06-og-rendering.md
    │   ├── renderer.ts                   # рендер + мемоизация статической карточки
    │   └── templates/registry.ts, whoami.tsx, staticCard.tsx
    │
    ├── routes/                            # см. 07-routes.md
    │   ├── home.ts, health.ts, ogImage.ts, share.ts
    │   └── nameBank.ts, locale.ts, config.ts
    │
    └── utils/hash.ts, utils/html.ts          # seedToFloats (см. 02-selector.md) и escapeHtml
```

## Тесты

Рядом с частью модулей лежат `*.test.ts` — юнит-тесты на чистые функции и валидацию, написанные на встроенном `node:test` (без jest/vitest и лишних зависимостей): `utils/hash.test.ts`, `names/selector.test.ts`, `names/bankValidator.test.ts`, `i18n/loader.test.ts`. Запускаются через `npm test`.

## Осознанное дублирование

`public/assets/selectorMath.js` и `src/names/selector.ts` реализуют одну и ту же математику дважды — для Node и для браузера. Это не забытый рефакторинг, а принятый компромисс: общий изоморфный модуль потребовал бы шага сборки фронтенда, чего проект сознательно избегает. При изменении алгоритма выбора обе копии нужно поддерживать синхронно вручную.
