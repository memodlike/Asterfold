# Asterfold 2.2.0

Production-hardening release для локальной новой вкладки Chrome. Дизайн и структура Pages → Boards → Bookmarks сохранены.

## Что изменилось

- 🔒 Ссылки и runtime messages проверяются до сохранения и повторно перед Chrome navigation.
- 🧳 Миграции v1–v5 и backup v1/v2 сохраняют закладки, порядок, настройки и `openMode`.
- ↕️ Порядок блоков/закладок атомарный и автоматически восстанавливает плотные/повреждённые ranks.
- 🖼️ Обои проходят MIME/decode/pixel/size/quota limits, уменьшаются и очищаются без orphan blobs.
- 🪶 Balanced и Low Power уменьшают GPU-стоимость без отключения функций.
- ♿ Меню, launcher, поиск, диалоги, Trash и toast получили keyboard/focus/axe gates.
- ☁️ Незавершённый cloud-клиент удалён из default release; данных наружу он не отправляет.
- 📦 Архивы создаются без внешнего `zip`, с одинаковыми timestamp/order/permissions и SHA-256.
- ✳️ Folded Asterisk унифицирован в manifest, popup, launcher и adaptive New Tab favicon.

## Установка

1. Скачайте **`Asterfold-Chrome.zip`** из самого нового GitHub Release.
2. Распакуйте архив.
3. Откройте `chrome://extensions`, включите режим разработчика.
4. Нажмите **Load unpacked / Загрузить распакованное**.
5. Выберите папку, где `manifest.json` лежит прямо в корне.

Перед обновлением рекомендуется экспортировать JSON backup. Автотесты подтверждают lossless update, но downgrade на старую версию автоматически не поддерживается.

## Проверка

Текущие команды, окружение, test IDs, SHA-256 и оставшиеся риски публикуются в `docs/audit/EVIDENCE.md` и `docs/audit/FINDINGS_STATUS.md`. Не используйте GitHub **Source code (zip)** как установочный архив.
