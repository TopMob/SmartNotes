# Темы и стили SmartNotes

> Цель документа: дать полную техническую карту по текущей системе тем/стилей и понятный план, как безопасно добавлять **новые темы** и **новые настройки темы** (например, «скругление»).

## 1) Что такое «тема» в SmartNotes

В проекте тема — это набор значений, который в рантайме преобразуется в CSS-переменные (`--primary`, `--bg`, `--radius-*`, и т.д.) на `document.documentElement`.

Основа:

- Базовые параметры темы описаны в `baseTheme` (цвета, blur, motion, density, radius, типографика и т.п.).
- Готовые темы лежат в `ThemeManager.themes`.
- Применение темы делается через `ThemeManager.applySettings()`, а прямое выставление CSS-переменных — через `ThemeManager.applyToRoot()`.

Ключевая идея: UI почти везде читает значения из CSS-переменных, поэтому расширение темы обычно сводится к:

1. добавить новое поле в объект темы,
2. пробросить его в `applyToRoot()` как CSS-переменную,
3. использовать эту CSS-переменную в стилях.

---

## 2) Архитектура и поток данных темы

## 2.1 Источник дефолтов

- `js/theme.js`:
  - `baseTheme` содержит базовые визуальные параметры.
  - `createPreset(bg, t, p)` создаёт тему из трёх основных цветов и наследует всё остальное из `baseTheme`.

## 2.2 Хранилища

### Локально (LocalStorage через SafeStorage)

- Основные настройки темы: ключ `app-theme`.
- Пользовательские пресеты: ключ `app-theme-custom-presets`.

### Облако (Firestore)

- Сохранение темы в `preferences/theme` для пользователя.
- Для облака формируется безопасный payload через `buildThemeCloudPayload()`.
- Локальные data URL изображений не отправляются в облако (это ожидаемое поведение).

## 2.3 Применение в рантайме

`ThemeManager.applySettings(settings, persist)`:

1. Берёт preset (`settings.preset`),
2. собирает итоговый `applied` объект,
3. нормализует opacity,
4. подставляет background (URL или локальная картинка),
5. вызывает `applyToRoot()`.

`ThemeManager.applyToRoot(theme)` ставит CSS custom properties на `:root`.

## 2.4 Связь с экраном настроек

- Страница «Appearance» рендерится в `js/ui.settings.js`.
- Изменения пользователя пишутся в `appearanceDraft` (`StateStore`).
- На любое изменение черновик применяется в рантайме (live-preview).
- При сохранении черновик уходит в общий draft настроек и далее в persist.

---

## 3) Что уже поддерживается системой темы

Сейчас можно настраивать:

- preset (включая custom пресеты),
- цвета `p/bg/t`,
- фоны main/sidebar (URL + локальная картинка),
- прозрачность UI (`uiOpacity`),
- прозрачность карточек (`cardsOpacity`).

Также в `baseTheme` уже существуют параметры, которые в UI не вынесены отдельными контролами, но технически поддерживаются (например `radius`, `blur`, `density`, `fontBase`, `hitSize`, `typeScale`, `spaceUnit`, `editorPadding`, `editorLineHeight`, `editorLetterSpacing`).

Это значит, что «настройка скругления» уже частично готова на уровне движка: достаточно добавить поле в сохраняемые настройки + контрол в UI.

---

## 4) Как добавить **новую встроенную тему**

Минимальный безопасный путь:

1. Открыть `js/theme.js`.
2. В `ThemeManager.themes` добавить новую запись:

```js
my_new_theme: createPreset("#101820", "#F2F4F8", "#7C3AED")
```

3. Добавить ключ темы в нужную группу в `ThemeManager.renderPicker()`:
   - `dark` или `light`.
4. (Опционально) Добавить локализованные названия темы в `js/lang.js`.
5. Проверить в UI:
   - тема отображается как точка в picker,
   - выбирается,
   - сохраняется и восстанавливается после перезагрузки.

### Важные замечания

- Если тему добавить только в `themes`, но не добавить в группы `renderPicker()`, она технически существует, но пользователь её не увидит.
- Для стабильности используйте только 6-значный HEX (`#RRGGBB`), т.к. `normalizeHex` ожидает именно этот формат.

---

## 5) Как добавить **новую настройку темы** (пример: `radius`)

Ниже — рекомендуемый end-to-end шаблон, который можно повторять для любых параметров (`blur`, `fontBase`, и т.д.).

## 5.1 Шаг 1. Расширить модель темы

Файл: `js/theme.js`

1. В `getDefaultSettings()` добавить поле, например:

```js
radius: 12
```

2. Во всех нормализациях/мержах, где собираются settings, добавить поддержку `radius`:
   - `loadAccountSettings()` (merge cloud/local),
   - `saveAccountSettings()` (normalization),
   - `buildThemeCloudPayload()` (если хотите синхронизацию с облаком),
   - `addCustomPreset()`, `updateCustomPreset()`, `getCustomPresets()`, `saveCustomPresets()`.

3. В `applySettings()` прокинуть `radius` в итоговый `applied` объект.

4. В `applyToRoot()` уже есть логика вычисления `--radius-sm/md/lg/xl` от `theme.radius`, поэтому после корректного прокидывания всё начнет работать автоматически.

### Рекомендация по нормализации

Добавьте helper, аналогичный `normalizeNumberInRange`, например:

```js
const normalizeRadius = (value) => normalizeNumberInRange(value, 0, 40, 12)
```

и используйте его везде при чтении/записи.

## 5.2 Шаг 2. Добавить контрол в Appearance UI

Файл: `js/ui.settings.js`

1. В разметку страницы appearance добавить новый блок (range input + текущее значение), по аналогии с opacity.
2. В `initAppearanceDraft()` и `renderAppearanceDraft()` добавить `radius` в draft-модель.
3. В `applyAppearanceDraft()` включить `radius` в `customTheme`.
4. Добавить `syncAppearanceRadiusControl(draft)`:
   - проставляет value в range,
   - вешает `input` listener,
   - при изменении:
     - обновляет `appearanceDraft`,
     - если выбран custom preset — вызывает `ThemeManager.updateCustomPreset(current.preset, { radius: nextValue })`.
5. Вызвать этот sync-метод там же, где вызываются sync-методы opacity/background.

## 5.3 Шаг 3. Сохранение и синхронизация

Проверить, что `radius` проходит полный цикл:

- runtime preview,
- local persist,
- cloud persist,
- чтение из cloud,
- custom preset CRUD.

Если параметр не нужен в облаке — можно хранить только локально, но это хуже для мульти-девайс UX.

## 5.4 Шаг 4. Использование в CSS

Большинство компонентов уже используют `var(--radius-*)`.

Если где-то стоит hardcoded `border-radius` (например `12px`), замените на релевантную переменную (`var(--radius-md)`/`var(--radius-lg)`), чтобы новый контрол влиял на этот блок.

---

## 6) Контракт данных темы (рекомендуемый)

Ниже — рекомендуемая целевая структура настроек темы (локально/в draft/в облаке где нужно):

```ts
interface ThemeSettings {
  preset: string;                  // "oled" | "standard_light" | "custom:<id>" | "manual"
  p: string;                       // #RRGGBB
  bg: string;                      // #RRGGBB
  t: string;                       // #RRGGBB
  uiOpacity: number;               // 0.4..1
  cardsOpacity: number;            // 0.5..1
  radius: number;                  // 0..40 (пример)
  mainBackgroundUrl: string;       // https://...
  sidebarBackgroundUrl: string;    // https://...
  mainBackgroundImage: string;     // local data/base64
  sidebarBackgroundImage: string;  // local data/base64
}
```

Даже если часть полей пока не отображается в UI, лучше держать единый формат объекта.

---

## 7) Чек-лист «добавил тему / добавил новый параметр»

## 7.1 Для новой темы

- [ ] Запись добавлена в `ThemeManager.themes`.
- [ ] Ключ добавлен в группу `renderPicker()`.
- [ ] (Опционально) Добавлены тексты в `lang.js`.
- [ ] Тема выбирается и сохраняется после reload.
- [ ] Для авторизованного пользователя тема синхронизируется в облако.

## 7.2 Для нового параметра (например radius)

- [ ] Поле добавлено в `getDefaultSettings()`.
- [ ] Поле проходит нормализацию при чтении/записи.
- [ ] Поле участвует в `applySettings()`.
- [ ] Поле выставляется в CSS (напрямую или через вычисления).
- [ ] Поле есть в `appearanceDraft`.
- [ ] Есть UI-контрол и live-preview.
- [ ] Поле сохранится в local storage.
- [ ] Поле корректно обрабатывается в custom presets.
- [ ] Поле (при необходимости) уходит в cloud payload.

---

## 8) Частые ошибки и как избежать

1. **Добавили поле в UI, но не в persist**
   - После reload значение «сбрасывается». Проверять `getDefaultSettings` + `saveSettings`/`saveAccountSettings`.

2. **Добавили поле в local, но не в cloud**
   - На другом устройстве эффект не воспроизводится. Проверять `buildThemeCloudPayload` и загрузку cloud настроек.

3. **Добавили тему в словарь, но не в picker**
   - Тема не видна пользователю.

4. **Нарушили формат цвета**
   - `normalizeHex` приведет к `#000000`, визуально «сломанная» тема.

5. **Забыли про custom preset путь**
   - Значение меняется в manual, но не сохраняется в custom пресет.

---

## 9) Минимальный план внедрения «настройки скругления»

1. **Данные**: добавить `radius` в все theme settings структуры.
2. **Нормализация**: clamp 0..40.
3. **UI**: range-слайдер в Appearance.
4. **Draft**: интеграция в `appearanceDraft`.
5. **Persist**: local + cloud + custom presets.
6. **CSS аудит**: заменить критичные hardcoded радиусы на `var(--radius-*)`.
7. **Тесты**:
   - ручной smoke (выбор темы, сохранение, reload),
   - `npm test`.

---

## 10) Где смотреть в коде (быстрые ссылки)

- Главная логика тем: `js/theme.js`.
- Экран Appearance и draft-flow: `js/ui.settings.js`.
- Базовые CSS переменные: `css/base.css`.
- Тематические overrides по `data-theme-preset`: `css/presets/active.css`.

---

## 11) Рекомендация по дальнейшему развитию

Чтобы новые параметры (radius/blur/typography/density) добавлялись быстрее и без дублирования, стоит:

1. Вынести **единый schema-объект** theme settings (с дефолтами + normalize функциями).
2. Использовать его везде: local load/save, cloud payload, custom presets, appearance draft.
3. Для UI-контролов сделать маленький helper-генератор (`bindRangeControl(field, min, max, fallback)`), чтобы не копировать логику как в opacity.

Это снизит риск рассинхронизаций и ускорит выпуск новых параметров темы.
