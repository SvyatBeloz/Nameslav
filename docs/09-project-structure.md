# Структура репозитория

```
Nameslav/
├── Dockerfile, docker-compose.yml, .dockerignore    # см. 08-deployment.md
├── .github/workflows/ci.yml     # typecheck + тесты + audit на Node 20 и 22,
│                                #   сборка образа и smoke-тест запущенного контейнера
├── .env.example
├── package.json, tsconfig.json, tsconfig.build.json
├── scripts/test.mjs             # поиск *.test.ts и запуск node --test, см. «Тесты»
├── README.md
│
├── docs/                        # эти документы
│
├── public/                      # статика фронтенда — отдаётся express.static, без сборки
│   ├── index.html               # шаблон главной: home-роут подставляет OG-мету (см. 07-routes.md)
│   ├── robots.txt               # обход разрешён целиком, см. 07-routes.md
│   ├── favicon.ico
│   └── assets/
│       ├── style.css
│       ├── script.js            # оркестрация: fetch конфигов, фингерпринт, выбор имени, анимация
│       ├── config.js            # fetch('/api/config.json') один раз, кэширует результат
│       ├── fingerprint.js        # сбор браузерных сигналов
│       ├── selectorMath.js        # зеркало src/names/selector.ts (Web Crypto вместо node:crypto)
│       ├── tilt.js                 # параллакс-наклон панели; общий для главной и share-страницы
│       └── fonts/                 # Noto Sans — кириллический шрифт для OG-картинок
│
└── src/
    ├── server.ts                 # точка входа: конфиг → банк → локаль → шрифты → createApp → listen
    ├── app.ts                    # сборка Express-приложения; отдельно от server.ts, чтобы тесты
    │                             #   могли поднять настоящий стек роутов, не слушая порт
    │
    ├── config/
    │   ├── env.ts                 # переменные окружения, typed-конфиг
    │   ├── port.ts                  # разбор и валидация PORT
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
    │   ├── errors.ts                        # терминальные 404/500, монтируются последними
    │   └── security.ts                      # CSP и прочие заголовки, монтируется первым
    │
    └── utils/hash.ts, utils/html.ts          # seedToFloats (см. 02-selector.md) и escapeHtml
```

## Тесты

Рядом с модулями лежат `*.test.ts` на встроенном `node:test` (без jest/vitest и лишних зависимостей): юнит-тесты на чистые функции и валидацию (`utils/hash.test.ts`, `utils/html.test.ts`, `names/selector.test.ts`, `names/shareToken.test.ts`, `names/bankValidator.test.ts`, `names/selectorMirror.test.ts`, `i18n/loader.test.ts`, `config/fingerprintFields.test.ts`) плюс два интеграционных: `app.test.ts` поднимает настоящее приложение на случайном порту и ходит в него через `fetch`, `routes/errors.test.ts` проверяет терминальные обработчики. Запускаются через `npm test`.

Запуск идёт через `scripts/test.mjs`, а не через глоб в `package.json`, потому что все очевидные варианты записи сломаны:

| Запись | Что не так |
|---|---|
| `--test src/**/*.test.ts` | `sh` не умеет globstar и раскрывает это ровно в `src/*/*.test.ts` — один уровень. Тесты глубже или в корне `src/` **молча** не запускаются, и зелёный прогон ничего не значит |
| `--test 'src/**/*.test.ts'` | Раскрытие остаётся Node, а он научился этому только в v21 — на Node 20 (который заявлен в `engines` и используется в Dockerfile) команда падает целиком |
| `--test src/` | Поиск по директории ориентируется на JS-соглашения об именовании, а не на `.ts`, и упирается в несуществующий входной `index.ts` |

Скрипт просто перечисляет найденные файлы явно: работает на всех поддерживаемых версиях и, в отличие от глоба, не может тихо найти меньше, чем нужно. Проверено на Node 20 и 22 (обе версии гоняются в CI).

## CI

`.github/workflows/ci.yml`: тайпчек, тесты, сборка и `npm audit --audit-level=high` на матрице Node 20/22, плюс отдельная джоба, которая собирает Docker-образ, **запускает** его и стучится в живые эндпоинты. Сборки образа мало: банк и локаль кладутся в `dist/` отдельными `COPY`, а рендерер OG грузит нативный аддон и файлы шрифтов на старте — путь, переставший резолвиться, ловится только реальным запуском.

## Осознанное дублирование

`public/assets/selectorMath.js` и `src/names/selector.ts` реализуют одну и ту же математику дважды — для Node и для браузера. Это не забытый рефакторинг, а принятый компромисс: общий изоморфный модуль потребовал бы шага сборки фронтенда, чего проект сознательно избегает. При изменении алгоритма выбора обе копии нужно поддерживать синхронно вручную.
