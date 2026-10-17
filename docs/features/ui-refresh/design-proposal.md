---
status: Proposed
created_at: "2026-10-16"
owner: Blazheiko
---

# UI refresh: модернізація дизайну та дизайн-системи

План-пропозиція з модернізації UI imgly: логотип, система іконок, стилізовані кнопки, преміальні
картки галереї та фірмовий колір шапки вікна в режимі PWA. Документ — вхід для SDD-конвеєра
(`specify` → `screens` → `tasks` → `implement`; api та data-model пропускаються — бекенду немає).

## Прийняті рішення

| # | Питання | Рішення |
|---|---|---|
| D1 | Фірмовий колір | **Iris `#6D5BFF`**, градієнт `#6D5BFF → #A35BFF` для логотипу і головної CTA |
| D2 | Шапка вікна (PWA title bar) | **Відтінок бренду, злитий із верхньою панеллю: два кольори — темна тема `#15122A`, світла тема `#F4F2FF`** |
| D3 | Джерело іконок | **Path-и з Lucide (ISC), скопійовані в реєстр `src/shared/icons/`** — без runtime-залежності |
| D4 | Шрифт | Системний стек лишається (SF на macOS); бренд передає логотип у SVG |
| D5 | Window Controls Overlay | Не в поточному обсязі — записано як опцію на майбутнє (§10) |

## 1. Діагноз поточного стану

| Проблема | Де видно | Причина в коді |
|---|---|---|
| Немає впізнаваності | у шапці лише текст «imgly» | `src/features/editor/components/EditorTopBar.vue:10` — простий `<span>`; іконки в `public/icons/` — типова піктограма «картинка з горою» |
| Шапка вікна не відповідає темі | чорна смуга над світлою панеллю | `theme-color` захардкоджений `#16181d` в `index.html:6` і в маніфесті `vite.config.ts:33` |
| Непослідовні кнопки | іконки є лише в Crop/Adjust/Draw/Undo/Redo; Export, Open image, Gallery, Delete, Close, Install — без | іконки — розрізнені інлайн-SVG у кожній фічі; розмір задано токеном відступу `--space-4` |
| Блідий вимкнений Export | світло-блакитна кнопка | вимкнений стан — `opacity: 0.45` на акцентному фоні |
| Картка галереї — «картинка + текст» | без рамки й фону, «Delete» висить окремим текстом | `src/features/gallery/components/GalleryEntry.vue` не має поверхні, тіні, hover, оверлей-дій |
| Нескомпонований порожній екран | CTA по центру, галерея ліворуч, багато пустоти | `EmptyCanvas` і `GalleryList` стоять один під одним без спільної сітки |
| Бракує шарів токенів | — | немає elevation, motion, розмірів іконок, розмірів заголовків (максимум 16px), success/warning |

## 2. Бренд і логотип

- **Логомарка:** дві кутові «рамки кадрування» (L-форми), що утворюють квадрат, і акцентна
  крапка/іскра всередині. Знак читається від 16px і прямо говорить «редактор зображень».
- **Вордмарк:** «imgly», `--font-weight-bold`, трекінг `--tracking-tight`.
- **Колір:** Iris `#6D5BFF` (D1). Білий текст на `#6D5BFF` ≈ 4.6:1 — AA для звичайного тексту.
- **Артефакти:**
  - `src/shared/ui/AppLogo.vue` — інлайн-SVG, пропси `size`, `withWordmark`; градієнт через токен.
  - З того самого SVG перегенерувати `public/icons/`: `favicon.svg` (новий), `icon-192.png`,
    `icon-512.png`, `icon-maskable-512.png` (безпечна зона 80%), `apple-touch-icon-180.png`.

## 3. Шапка вікна в PWA (D2)

Шапка вікна і верхня панель застосунку мають один колір — відтінок бренду під поточну тему — і
зливаються в одну смугу.

| Тема | `--color-titlebar` | Текст / іконки на панелі |
|---|---|---|
| Темна (за замовчуванням) | `#15122A` — глибокий індиго бренду | `--color-on-titlebar` світлий |
| Світла | `#F4F2FF` — світлий лавандовий тон бренду | `--color-on-titlebar` темний |

- Токени `--color-titlebar`, `--color-on-titlebar`, `--color-on-titlebar-muted`,
  `--color-titlebar-border` задаються в обох блоках `tokens.css` (`:root` і
  `@media (prefers-color-scheme: light)`).
- `index.html` — два мета-теги, браузер (Chromium, Safari) обирає за темою системи:
  ```html
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#15122A" />
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F4F2FF" />
  ```
- Маніфест (`vite.config.ts`) підтримує лише одне значення: `theme_color: '#15122A'` і
  `background_color: '#15122A'` (темна тема — тема за замовчуванням); під час роботи вікна колір
  перекривають мета-теги з `media`.
- Значення в `index.html` дублюють токени (мета-тег не читає CSS-змінні) — це єдиний дозволений
  виняток; поруч коментар із посиланням на `tokens.css`.
- `EditorTopBar` використовує `--color-titlebar` як фон.

## 4. Система іконок (D3)

- **Примітив** `src/shared/ui/Icon.vue`: проп `name` (типізований union імен із реєстру), `size`
  (`sm` | `md` | `lg`), завжди `aria-hidden="true"` і `focusable="false"`; колір — `currentColor`.
- **Реєстр** `src/shared/icons/index.ts`: `name → path data` для сітки 24×24, штрих 1.75,
  `stroke-linecap/linejoin: round`. Поруч — `LICENSE-lucide` (ISC-атрибуція).
- **Токени:** `--icon-size-sm: 16px`, `--icon-size-md: 20px`, `--icon-size-lg: 24px` (замість
  `--space-4` у ролі розміру).
- **`BaseButton`:** проп `icon`, `iconOnly` (тоді обов'язкові `aria-label` і `title` із
  шорткатом), розміри `sm` / `md` / `lg`, новий варіант `danger`.
- Перенести наявні інлайн-SVG (undo-redo, crop-rotate, adjust, draw) у реєстр.

| Дія | Іконка Lucide |
|---|---|
| Open image | `image-plus` |
| Gallery | `layout-grid` |
| Undo / Redo | `undo-2` / `redo-2` |
| Crop and rotate | `crop` |
| Adjust | `sliders-horizontal` |
| Draw | `pen-line` |
| Export | `download` |
| Install | `monitor-down` |
| Delete | `trash-2` |
| Close / Dismiss / Cancel | `x` |
| Apply | `check` |
| Reload (оновлення) | `refresh-cw` |
| Reset | `rotate-ccw` |
| Пошкоджена Work | `image-off` |
| Нотатка про сховище | `info` |

## 5. Кнопки та верхня панель

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⌜•⌟ imgly │ ▦ Gallery │  ↶  ↷  │ ⌗ Crop  ⫶ Adjust  ✎ Draw │ ⇩ Install [⇩ Export]│
└──────────────────────────────────────────────────────────────────────────────┘
```

- Ліворуч — `AppLogo` з вордмарком. Далі групи з тонкими роздільниками: Gallery │ Undo/Redo
  (icon-only) │ інструменти (tool rail) │ Install і **Export** (primary) праворуч.
- `--toolbar-size: 56px`; кнопки `md` 36px; CTA порожнього екрана `lg` 44px; `sm` 28px.
- **Primary:** легкий градієнт бренду, тонкий світлий кант зверху, `--shadow-sm`; hover —
  світліше, active — темніше.
- **Disabled:** нейтральний `--color-surface-sunken` і приглушений текст замість напівпрозорого
  акценту.
- **Danger:** підтвердження в `DeleteWorkDialog` переходить із `primary` на `danger` з `trash-2`.
- **Pressed (відкритий інструмент):** фон `--color-accent-subtle`, рамка `--color-accent`.

## 6. Галерея та порожній стан

**Порожній стан — `DropZone`:** велика картка з пунктирною рамкою, іконка `image-plus` розміру
`lg`, заголовок, кнопка `lg` «Open image» з іконкою і підказка про перетягування. Під час drag
рамка й фон підсвічуються акцентом.

**Шапка галереї:** заголовок «Gallery», бейдж-лічильник «1 / 20» із тонким прогрес-баром
зайнятих місць; нотатка про сховище — інфо-виноска з іконкою `info`.

**Картка Work — `WorkCard`:**

```
┌────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ [🗑] │  ← hover / focus-within: кругла «скляна» кнопка Delete
│ ▓▓▓  мініатюра  ▓▓▓▓▓ │     мініатюра contain поверх розмитої копії себе (без смуг)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │     ● Open — бейдж-«пігулка» для поточної Work
├────────────────────────┤
│ 2026-10-16 14.46.53    │  назва з ellipsis
│ Just now               │  метадані приглушеним кольором
└────────────────────────┘
```

- Поверхня `--color-surface-raised`, радіус `--radius-lg` (12px), рамка 1px
  `--color-border-subtle`, `--shadow-sm`.
- Hover: `translateY(-2px)`, `--shadow-md`, рамка з відтінком акценту, мініатюра `scale(1.03)`;
  усе вимикається при `prefers-reduced-motion`.
- Сітка: `repeat(auto-fill, minmax(200px, 1fr))`, gap `--space-6`.
- Доступність: Delete видимий на `:focus-within` і завжди на сенсорних пристроях
  (`@media (hover: none)`); aria-імена й підказки (`hintOpenWorkCannotBeDeleted`) без змін.
- Пошкоджена Work: іконка `image-off` і рамка `--color-warning`.
- **Контракти DOM зберігаються:** `data-entry-id`, `data-delete-id`, `data-testid`, aria-label —
  юніт- і e2e-тести не повинні ламатися.

## 7. Токени v2 (`src/shared/styles/tokens.css`)

| Група | Додати / змінити |
|---|---|
| Бренд | `--color-brand: #6D5BFF`, `--color-brand-gradient`, `--color-accent*` перевести на Iris (hover/active під кожну тему), `--color-accent-subtle` |
| Шапка | `--color-titlebar` (`#15122A` темна / `#F4F2FF` світла), `--color-on-titlebar`, `--color-on-titlebar-muted`, `--color-titlebar-border` |
| Поверхні | `--color-surface-sunken`, `--color-surface-overlay`, `--color-border-subtle`, `--color-border-strong` |
| Семантика | `--color-success`, `--color-warning`, `--color-danger-subtle` |
| Elevation | `--shadow-sm` / `--shadow-md` / `--shadow-lg`, окремо для темної і світлої теми |
| Радіуси | `--radius-sm 6`, `--radius-md 8`, `--radius-lg 12`, `--radius-xl 16`, `--radius-full 999` |
| Типографіка | `--font-size-xl 20`, `--font-size-2xl 24`, `--font-size-display 32`, `--line-height-*`, `--tracking-tight` |
| Motion | `--duration-fast 120ms`, `--duration-base 200ms`, `--ease-out`; нульові тривалості при `prefers-reduced-motion` |
| Розміри | `--icon-size-sm/md/lg`, `--control-height-sm/md/lg`, `--toolbar-size: 56px` |

Нові й змінені примітиви реєструються в `docs/design-system.md` (§Token source, §Component
inventory): `Icon`, `AppLogo`, `DropZone`, `WorkCard`, `BaseButton` (`icon`, `iconOnly`, `size`,
`danger`).

## 8. Фази поставки

| # | PR | Зміст | Розмір |
|---|---|---|---|
| 1 | Foundations | токени v2, `Icon` + реєстр Lucide, `BaseButton` (icon, розміри, danger), оновлення `design-system.md` | M |
| 2 | Brand & title bar | `AppLogo`, верхня панель `--color-titlebar` із групами, нові PWA-іконки, два `theme-color` за темою і маніфест | S |
| 3 | Icons everywhere | іконки на всіх діях, перенесення інлайн-SVG у реєстр, danger у діалогах | S |
| 4 | Gallery premium | `WorkCard`, `DropZone`, лічильник місць, hover/focus, пошкоджений стан | M |

## 9. Критерії якості

- Гейт кожного PR: `pnpm lint && pnpm typecheck && pnpm test`; для фаз 2 і 4 також `pnpm test:e2e`.
- Контраст WCAG AA: текст ≥ 4.5:1, UI-елементи ≥ 3:1 — в обох темах, зокрема на панелі `--color-titlebar`.
- Фокус завжди видимий через `--color-focus-ring`; клавіатурний доступ до всіх дій не погіршується.
- Жодних хардкоджених кольорів, відступів чи шрифтів поза `tokens.css`; жодного UI-кіта.
- Візуальна перевірка в браузері й у встановленому PWA (title bar) для обох тем.

## 10. Опції на майбутнє

### Window Controls Overlay (WCO)

Застосунок сам малює область заголовка вікна в десктопному Chromium: логотип поруч зі
«світлофорами», меню й дії в тій самій смузі.

- Маніфест: `display_override: ['window-controls-overlay']`; fallback — звичайний `standalone`.
- Розкладка через `env(titlebar-area-x | -y | -width | -height)`; зона перетягування —
  `app-region: drag`, інтерактивні елементи — `app-region: no-drag`.
- Перемикання режиму відстежується через `navigator.windowControlsOverlay` (`geometrychange`).
- Обмеження: лише desktop Chromium; Safari і Firefox показують звичайну шапку з `theme-color`
  (фаза 2), тож WCO — надбудова, а не заміна.
- Розмір: S. Передумова — завершена фаза 2.
