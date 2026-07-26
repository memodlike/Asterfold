# Asterfold 2.2.2 — final hardening

Patch-релиз делает local-first новую вкладку Chrome надёжнее перед отправкой на проверку Chrome Web Store. Узнаваемый дизайн, Frost Light, Graphite Dark, стекло, launcher снизу слева и структура Pages → Boards → Bookmarks сохранены.

## Что изменилось

- 🧳 Выборочный backup теперь сам проходит строгую проверку и содержит только выбранные закладки и необходимые родительские блоки/страницы.
- 🔁 Повторный merge удалённых данных изолирует batch ID, а восстановление не задевает соседнюю импортированную копию.
- 📐 Импорт, дублирование, перемещение блоков и массовые операции используют единый атомарный порядок без конфликтующих ranks.
- 🔒 Privacy Mode скрывает реальные названия и URL в карточках, редакторе, корзине, drag overlay, toast, popup и accessibility tree.
- ⚡ Quick Save не может сохранить ссылку в блок другой страницы; без подходящего блока кнопка сохранения отключена.
- 🖼️ Обои проходят единые ограничения декодирования, размеров и backup; dangling legacy-ссылки безопасно сбрасываются.
- 🧹 Массовый Undo, Trash и free-grid swap выполняются одной транзакцией и не оставляют частичное состояние при ошибке.
- 🗂️ Page actions теперь доступны из клавиатурного меню: переименование, дублирование, default, перемещение и удаление.
- 🧭 Background восстанавливает Trash alarm, обрабатывает rejected tasks и очищает badge устойчивым MV3 alarm.
- 🧪 Локально выполнены typecheck, lint, 129 unit/integration/component тестов, 5 реальных MV3 E2E, Store validation, воспроизводимый release и production audit с 0 уязвимостей.

**Ready for submission review.** Это не означает, что расширение уже отправлено, одобрено или опубликовано Chrome Web Store.

## Установка

1. Скачайте **`Asterfold-Chrome.zip`** из самого нового GitHub Release.
2. Распакуйте архив.
3. Откройте `chrome://extensions`, включите режим разработчика.
4. Нажмите **Load unpacked / Загрузить распакованное**.
5. Выберите папку, где `manifest.json` лежит прямо в корне.

Перед обновлением рекомендуется экспортировать JSON backup. Автотесты подтверждают lossless update, но downgrade на старую версию автоматически не поддерживается.

## Проверка

Текущие команды, окружение, test IDs, SHA-256 и оставшиеся риски публикуются в `docs/audit/EVIDENCE.md` и `docs/audit/FINDINGS_STATUS.md`. Полный development audit по-прежнему показывает advisories в build-only WXT/ESLint toolchain; production dependencies чисты. Не используйте GitHub **Source code (zip)** как установочный архив.

## Chrome Web Store documentation

The repository contains a privacy policy, Privacy Practices answers, localized listing copy and an owner submission checklist. These materials describe readiness work only; they do not claim that Chrome Web Store review or publication has occurred.

- [Privacy policy](../security/privacy.md)
- [Privacy Practices answers](../store/privacy-practices.md)
- [Submission checklist](../store/submission-checklist.md)
- [Store listing values](../../store-assets/listing/submission-values.md)
