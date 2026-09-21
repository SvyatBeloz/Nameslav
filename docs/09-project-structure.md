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
    ├── server.ts                 # точка входа: конфиг → банк → локаль → шрифты → createApp → listen
    ├── app.ts                    # сборка Express-приложения; отдельно от server.ts, чтобы тесты
    │                             #   могли поднять настоящий стек роутов, не слушая порт
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
    │   ├── nameBank.ts, locale.ts, config.ts
    │   └── errors.ts                        # терминальные 404/500, монтируются последними
    │
    └── utils/hash.ts, utils/html.ts          # seedToFloats (см. 02-selector.md) и escapeHtml
```

## Тесты

Рядом с модулями лежат `*.test.ts` на встроенном `node:test` (без jest/vitest и лишних зависимостей): юнит-тесты на чистые функции и валидацию (`utils/hash.test.ts`, `utils/html.test.ts`, `names/selector.test.ts`, `names/shareToken.test.ts`, `names/bankValidator.test.ts`, `names/selectorMirror.test.ts`, `i18n/loader.test.ts`, `config/fingerprintFields.test.ts`) плюс два интеграционных: `app.test.ts` поднимает настоящее приложение на случайном порту и ходит в него через `fetch`, `routes/errors.test.ts` проверяет терминальные обработчики. Запускаются через `npm test`.

Глоб в `npm test` обязан быть в кавычках (`--test 'src/**/*.test.ts'`): `sh` не поддерживает globstar и раскрывает `src/**/*.test.ts` ровно в `src/*/*.test.ts` — один уровень вложенности. Node (≥21) раскрывает шаблон сам и находит все файлы, включая `src/app.test.ts` в корне.

## Осознанное дублирование

`public/assets/selectorMath.js` и `src/names/selector.ts` реализуют одну и ту же математику дважды — для Node и для браузера. Это не забытый рефакторинг, а принятый компромисс: общий изоморфный модуль потребовал бы шага сборки фронтенда, чего проект сознательно избегает. При изменении алгоритма выбора обе копии нужно поддерживать синхронно вручную.
