# Asterfold 2.2.1 — Chrome Web Store readiness

Patch-релиз для подготовки local-first новой вкладки Chrome к отправке на проверку Chrome Web Store. Дизайн и структура Pages → Boards → Bookmarks сохранены.

## Что изменилось

- 🔐 Удалено неиспользуемое разрешение `storage`; данные по-прежнему хранятся локально в IndexedDB.
- 🧳 Версия приложения берётся из одного источника; backup v3 сохраняет активные пользовательские обои и продолжает принимать backup v1/v2.
- 🖼️ Данные обоев в backup ограничены по типу и размеру и проверяются до атомарного восстановления.
- 📄 Обновлены Privacy Policy, Privacy Practices, permission rationale и чек-лист отправки.
- 🛍️ Добавлены реальные Store-скриншоты, иконка, promo tile, marquee и листинги EN/RU.
- ✅ Добавлены автоматические проверки размеров Store assets, разрешений Manifest V3, версии, remote code и воспроизводимости архивов.
- 📦 Store-материалы собираются отдельно и не попадают в ZIP расширения.
- 🧪 Кандидат 2.2.1 прошёл typecheck, lint, 106 unit-тестов, 5 реальных MV3 E2E, проверку воспроизводимости и production audit без известных уязвимостей.

**Ready for submission to Chrome Web Store.** Это не означает, что расширение уже отправлено, одобрено или опубликовано.

## Установка

1. Скачайте **`Asterfold-Chrome.zip`** из самого нового GitHub Release.
2. Распакуйте архив.
3. Откройте `chrome://extensions`, включите режим разработчика.
4. Нажмите **Load unpacked / Загрузить распакованное**.
5. Выберите папку, где `manifest.json` лежит прямо в корне.

Перед обновлением рекомендуется экспортировать JSON backup. Автотесты подтверждают lossless update, но downgrade на старую версию автоматически не поддерживается.

## Проверка

Текущие команды, окружение, test IDs, SHA-256 и оставшиеся риски публикуются в `docs/audit/EVIDENCE.md` и `docs/audit/FINDINGS_STATUS.md`. Не используйте GitHub **Source code (zip)** как установочный архив.

## Chrome Web Store documentation

The repository contains a privacy policy, Privacy Practices answers, localized listing copy and an owner submission checklist. These materials describe readiness work only; they do not claim that Chrome Web Store review or publication has occurred.

- [Privacy policy](../security/privacy.md)
- [Privacy Practices answers](../store/privacy-practices.md)
- [Submission checklist](../store/submission-checklist.md)
- [Store listing values](../../store-assets/listing/submission-values.md)
