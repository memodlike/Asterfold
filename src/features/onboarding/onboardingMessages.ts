import type { LocalePreference } from "../../domain/models";

export type OnboardingMessageKey =
  | "greeting.morning"
  | "greeting.afternoon"
  | "greeting.evening"
  | "welcome.title"
  | "welcome.body"
  | "welcome.privacy"
  | "welcome.language"
  | "step.welcome"
  | "step.import"
  | "step.appearance"
  | "step.review"
  | "import.title"
  | "import.body"
  | "import.default.title"
  | "import.default.body"
  | "import.chrome.title"
  | "import.chrome.body"
  | "import.chrome.permission"
  | "import.chrome.denied"
  | "import.html.title"
  | "import.html.body"
  | "import.backup.title"
  | "import.backup.body"
  | "import.preview"
  | "import.empty"
  | "import.parsing"
  | "appearance.title"
  | "appearance.body"
  | "appearance.preset"
  | "appearance.density"
  | "appearance.compact"
  | "appearance.comfortable"
  | "appearance.spacious"
  | "appearance.rows"
  | "review.title"
  | "review.body"
  | "review.source"
  | "review.language"
  | "review.theme"
  | "review.layout"
  | "review.duplicates"
  | "action.continue"
  | "action.back"
  | "action.finish"
  | "action.finishing"
  | "action.skip"
  | "action.retry"
  | "skip.title"
  | "skip.body"
  | "skip.continue"
  | "skip.confirm"
  | "status.ready"
  | "status.error";

type AppLocale = Exclude<LocalePreference, "auto">;
type Dictionary = Record<OnboardingMessageKey, string>;

const en: Dictionary = {
  "greeting.morning": "Good morning",
  "greeting.afternoon": "Good afternoon",
  "greeting.evening": "Good evening",
  "welcome.title": "Welcome to Asterfold",
  "welcome.body": "Set up a private, local-first visual bookmark workspace in a few steps.",
  "welcome.privacy": "Your data stays in this browser profile. No account and no analytics.",
  "welcome.language": "Interface language",
  "step.welcome": "Welcome",
  "step.import": "Bookmarks",
  "step.appearance": "Appearance",
  "step.review": "Review",
  "import.title": "Bring bookmarks or start fresh",
  "import.body": "Nothing is written until you finish setup.",
  "import.default.title": "Start with Asterfold",
  "import.default.body": "Keep the starter workspace. You can import later in Settings.",
  "import.chrome.title": "Import from Chrome",
  "import.chrome.body": "Copy the Chrome bookmark tree into Asterfold without changing the originals.",
  "import.chrome.permission": "Chrome will ask for temporary bookmark access only after you press the import button. Processing is local.",
  "import.chrome.denied": "Bookmark access was not granted. Choose another source or retry.",
  "import.html.title": "Import bookmark HTML",
  "import.html.body": "Choose a Netscape-format bookmark file exported by a browser.",
  "import.backup.title": "Restore Asterfold backup",
  "import.backup.body": "Validate and preview an Asterfold JSON backup before applying it.",
  "import.preview": "{bookmarks} bookmarks · {folders} folders · {pages} pages · {boards} boards",
  "import.empty": "No bookmarks were found in this source.",
  "import.parsing": "Validating the selected file…",
  "appearance.title": "Choose your starting appearance",
  "appearance.body": "These changes are previews until setup is finished.",
  "appearance.preset": "Theme preset",
  "appearance.density": "Density",
  "appearance.compact": "Compact",
  "appearance.comfortable": "Comfortable",
  "appearance.spacious": "Spacious",
  "appearance.rows": "Workspace rows",
  "review.title": "Review setup",
  "review.body": "Asterfold will apply these choices in one controlled operation.",
  "review.source": "Data source",
  "review.language": "Language",
  "review.theme": "Theme",
  "review.layout": "Layout",
  "review.duplicates": "Duplicates",
  "action.continue": "Continue",
  "action.back": "Back",
  "action.finish": "Finish setup",
  "action.finishing": "Finishing setup…",
  "action.skip": "Skip setup",
  "action.retry": "Retry",
  "skip.title": "Skip guided setup?",
  "skip.body": "Asterfold will keep its default workspace and appearance. You can import and customize later in Settings.",
  "skip.continue": "Continue setup",
  "skip.confirm": "Skip and use defaults",
  "status.ready": "Setup complete",
  "status.error": "Setup could not be completed. Your previous workspace was restored.",
};

const ru: Dictionary = {
  "greeting.morning": "Доброе утро",
  "greeting.afternoon": "Добрый день",
  "greeting.evening": "Добрый вечер",
  "welcome.title": "Добро пожаловать в Asterfold",
  "welcome.body": "Настройте приватное локальное пространство для закладок за несколько шагов.",
  "welcome.privacy": "Данные остаются в этом профиле браузера. Аккаунт и аналитика не используются.",
  "welcome.language": "Язык интерфейса",
  "step.welcome": "Приветствие",
  "step.import": "Закладки",
  "step.appearance": "Оформление",
  "step.review": "Проверка",
  "import.title": "Перенесите закладки или начните с нуля",
  "import.body": "До завершения настройки данные не изменяются.",
  "import.default.title": "Начать с Asterfold",
  "import.default.body": "Оставить стартовое пространство. Импорт будет доступен позже в Настройках.",
  "import.chrome.title": "Импортировать из Chrome",
  "import.chrome.body": "Скопировать дерево закладок Chrome в Asterfold, не изменяя оригиналы.",
  "import.chrome.permission": "Chrome запросит временный доступ только после нажатия кнопки импорта. Обработка выполняется локально.",
  "import.chrome.denied": "Доступ к закладкам не предоставлен. Выберите другой источник или повторите попытку.",
  "import.html.title": "Импортировать HTML закладок",
  "import.html.body": "Выберите файл закладок формата Netscape, экспортированный из браузера.",
  "import.backup.title": "Восстановить копию Asterfold",
  "import.backup.body": "Проверьте и просмотрите JSON-копию Asterfold перед применением.",
  "import.preview": "Закладок: {bookmarks} · папок: {folders} · страниц: {pages} · блоков: {boards}",
  "import.empty": "В выбранном источнике закладки не найдены.",
  "import.parsing": "Проверяем выбранный файл…",
  "appearance.title": "Выберите начальное оформление",
  "appearance.body": "Изменения остаются предпросмотром до завершения настройки.",
  "appearance.preset": "Предустановка темы",
  "appearance.density": "Плотность",
  "appearance.compact": "Компактная",
  "appearance.comfortable": "Удобная",
  "appearance.spacious": "Просторная",
  "appearance.rows": "Ряды рабочего пространства",
  "review.title": "Проверьте настройку",
  "review.body": "Asterfold применит выбранные параметры одной контролируемой операцией.",
  "review.source": "Источник данных",
  "review.language": "Язык",
  "review.theme": "Тема",
  "review.layout": "Компоновка",
  "review.duplicates": "Дубликаты",
  "action.continue": "Продолжить",
  "action.back": "Назад",
  "action.finish": "Завершить настройку",
  "action.finishing": "Завершаем настройку…",
  "action.skip": "Пропустить настройку",
  "action.retry": "Повторить",
  "skip.title": "Пропустить пошаговую настройку?",
  "skip.body": "Asterfold сохранит стандартное пространство и оформление. Импорт и персонализация будут доступны позже в Настройках.",
  "skip.continue": "Продолжить настройку",
  "skip.confirm": "Пропустить и оставить стандартные настройки",
  "status.ready": "Настройка завершена",
  "status.error": "Не удалось завершить настройку. Предыдущее пространство восстановлено.",
};

const kk: Dictionary = {
  "greeting.morning": "Қайырлы таң",
  "greeting.afternoon": "Қайырлы күн",
  "greeting.evening": "Қайырлы кеш",
  "welcome.title": "Asterfold қолданбасына қош келдіңіз",
  "welcome.body": "Жеке және жергілікті бетбелгі кеңістігін бірнеше қадамда баптаңыз.",
  "welcome.privacy": "Деректер осы браузер профилінде қалады. Тіркелгі мен аналитика қолданылмайды.",
  "welcome.language": "Интерфейс тілі",
  "step.welcome": "Қош келдіңіз",
  "step.import": "Бетбелгілер",
  "step.appearance": "Безендіру",
  "step.review": "Тексеру",
  "import.title": "Бетбелгілерді көшіріңіз немесе жаңадан бастаңыз",
  "import.body": "Баптау аяқталғанша ешбір дерек жазылмайды.",
  "import.default.title": "Asterfold-пен бастау",
  "import.default.body": "Бастапқы кеңістікті қалдырыңыз. Кейін Баптаулардан импорттай аласыз.",
  "import.chrome.title": "Chrome-нан импорттау",
  "import.chrome.body": "Chrome бетбелгілерін түпнұсқаларын өзгертпей Asterfold-қа көшіру.",
  "import.chrome.permission": "Chrome уақытша рұқсатты импорт түймесін басқаннан кейін ғана сұрайды. Өңдеу жергілікті орындалады.",
  "import.chrome.denied": "Бетбелгілерге рұқсат берілмеді. Басқа дереккөзді таңдаңыз немесе қайталаңыз.",
  "import.html.title": "HTML бетбелгілерін импорттау",
  "import.html.body": "Браузерден экспортталған Netscape пішіміндегі файлды таңдаңыз.",
  "import.backup.title": "Asterfold сақтық көшірмесін қалпына келтіру",
  "import.backup.body": "JSON сақтық көшірмесін қолданар алдында тексеріп, алдын ала қараңыз.",
  "import.preview": "Бетбелгі: {bookmarks} · қалта: {folders} · бет: {pages} · блок: {boards}",
  "import.empty": "Бұл дереккөзден бетбелгілер табылмады.",
  "import.parsing": "Таңдалған файл тексерілуде…",
  "appearance.title": "Бастапқы көріністі таңдаңыз",
  "appearance.body": "Баптау аяқталғанша өзгерістер тек алдын ала қарау болып қалады.",
  "appearance.preset": "Тақырып үлгісі",
  "appearance.density": "Тығыздық",
  "appearance.compact": "Ықшам",
  "appearance.comfortable": "Ыңғайлы",
  "appearance.spacious": "Кең",
  "appearance.rows": "Жұмыс кеңістігінің жолдары",
  "review.title": "Баптауды тексеріңіз",
  "review.body": "Asterfold таңдауларды бір басқарылатын операциямен қолданады.",
  "review.source": "Дереккөз",
  "review.language": "Тіл",
  "review.theme": "Тақырып",
  "review.layout": "Орналасу",
  "review.duplicates": "Телнұсқалар",
  "action.continue": "Жалғастыру",
  "action.back": "Артқа",
  "action.finish": "Баптауды аяқтау",
  "action.finishing": "Баптау аяқталуда…",
  "action.skip": "Баптауды өткізіп жіберу",
  "action.retry": "Қайталау",
  "skip.title": "Қадамдық баптауды өткізіп жіберу керек пе?",
  "skip.body": "Asterfold әдепкі кеңістік пен көріністі сақтайды. Кейін Баптаулардан импорттап, өзгерте аласыз.",
  "skip.continue": "Баптауды жалғастыру",
  "skip.confirm": "Өткізіп, әдепкі мәндерді қолдану",
  "status.ready": "Баптау аяқталды",
  "status.error": "Баптауды аяқтау мүмкін болмады. Алдыңғы кеңістік қалпына келтірілді.",
};

const es: Dictionary = { ...en,
  "greeting.morning": "Buenos días", "greeting.afternoon": "Buenas tardes", "greeting.evening": "Buenas noches",
  "welcome.title": "Te damos la bienvenida a Asterfold", "welcome.body": "Configura en pocos pasos un espacio visual de marcadores privado y local.", "welcome.privacy": "Tus datos permanecen en este perfil del navegador. Sin cuenta ni analíticas.", "welcome.language": "Idioma de la interfaz",
  "step.welcome": "Bienvenida", "step.import": "Marcadores", "step.appearance": "Apariencia", "step.review": "Revisión",
  "import.title": "Importa marcadores o empieza de cero", "import.body": "No se escribirá nada hasta que finalices la configuración.", "import.default.title": "Empezar con Asterfold", "import.default.body": "Conserva el espacio inicial. Podrás importar más tarde desde Ajustes.",
  "import.chrome.title": "Importar desde Chrome", "import.chrome.body": "Copia el árbol de marcadores sin modificar los originales.", "import.chrome.permission": "Chrome solicitará acceso temporal solo después de pulsar importar. El procesamiento es local.", "import.chrome.denied": "No se concedió acceso. Elige otra fuente o vuelve a intentarlo.",
  "import.html.title": "Importar HTML de marcadores", "import.html.body": "Selecciona un archivo Netscape exportado por un navegador.", "import.backup.title": "Restaurar copia de Asterfold", "import.backup.body": "Valida y revisa la copia JSON antes de aplicarla.",
  "appearance.title": "Elige la apariencia inicial", "appearance.body": "Los cambios son una vista previa hasta finalizar.", "appearance.preset": "Tema", "appearance.density": "Densidad", "appearance.compact": "Compacta", "appearance.comfortable": "Cómoda", "appearance.spacious": "Amplia", "appearance.rows": "Filas del espacio",
  "review.title": "Revisa la configuración", "review.body": "Asterfold aplicará todo en una sola operación controlada.", "action.continue": "Continuar", "action.back": "Atrás", "action.finish": "Finalizar configuración", "action.finishing": "Finalizando…", "action.skip": "Omitir configuración", "action.retry": "Reintentar",
  "skip.title": "¿Omitir la configuración guiada?", "skip.body": "Asterfold conservará los valores predeterminados. Podrás importar y personalizar más tarde.", "skip.continue": "Continuar configuración", "skip.confirm": "Omitir y usar valores predeterminados", "status.ready": "Configuración completada", "status.error": "No se pudo completar. Se restauró el espacio anterior."
};

const de: Dictionary = { ...en,
  "greeting.morning": "Guten Morgen", "greeting.afternoon": "Guten Tag", "greeting.evening": "Guten Abend",
  "welcome.title": "Willkommen bei Asterfold", "welcome.body": "Richte in wenigen Schritten einen privaten, lokalen Lesezeichen-Arbeitsbereich ein.", "welcome.privacy": "Deine Daten bleiben in diesem Browserprofil. Kein Konto und keine Analysen.", "welcome.language": "Oberflächensprache",
  "step.welcome": "Willkommen", "step.import": "Lesezeichen", "step.appearance": "Darstellung", "step.review": "Prüfen",
  "import.title": "Lesezeichen übernehmen oder neu starten", "import.body": "Bis zum Abschluss werden keine Daten geschrieben.", "import.default.title": "Mit Asterfold starten", "import.default.body": "Den Startbereich behalten. Import ist später in den Einstellungen möglich.",
  "import.chrome.title": "Aus Chrome importieren", "import.chrome.body": "Den Chrome-Lesezeichenbaum kopieren, ohne Originale zu verändern.", "import.chrome.permission": "Chrome fragt erst nach Klick auf Import nach temporärem Zugriff. Die Verarbeitung erfolgt lokal.", "import.chrome.denied": "Zugriff wurde nicht erteilt. Andere Quelle wählen oder erneut versuchen.",
  "import.html.title": "Lesezeichen-HTML importieren", "import.html.body": "Eine vom Browser exportierte Netscape-Datei auswählen.", "import.backup.title": "Asterfold-Sicherung wiederherstellen", "import.backup.body": "JSON-Sicherung vor dem Anwenden prüfen und ansehen.",
  "appearance.title": "Startdarstellung wählen", "appearance.body": "Änderungen bleiben bis zum Abschluss eine Vorschau.", "appearance.preset": "Designvorlage", "appearance.density": "Dichte", "appearance.compact": "Kompakt", "appearance.comfortable": "Komfortabel", "appearance.spacious": "Großzügig", "appearance.rows": "Arbeitsbereichszeilen",
  "review.title": "Einrichtung prüfen", "review.body": "Asterfold übernimmt alles in einem kontrollierten Vorgang.", "action.continue": "Weiter", "action.back": "Zurück", "action.finish": "Einrichtung abschließen", "action.finishing": "Einrichtung wird abgeschlossen…", "action.skip": "Einrichtung überspringen", "action.retry": "Erneut versuchen",
  "skip.title": "Geführte Einrichtung überspringen?", "skip.body": "Asterfold behält die Standardwerte. Import und Anpassung sind später möglich.", "skip.continue": "Einrichtung fortsetzen", "skip.confirm": "Überspringen und Standardwerte nutzen", "status.ready": "Einrichtung abgeschlossen", "status.error": "Einrichtung fehlgeschlagen. Der vorherige Arbeitsbereich wurde wiederhergestellt."
};

const fr: Dictionary = { ...en,
  "greeting.morning": "Bonjour", "greeting.afternoon": "Bon après-midi", "greeting.evening": "Bonsoir",
  "welcome.title": "Bienvenue dans Asterfold", "welcome.body": "Configurez en quelques étapes un espace visuel de favoris privé et local.", "welcome.privacy": "Vos données restent dans ce profil de navigateur. Aucun compte ni analyse.", "welcome.language": "Langue de l’interface",
  "step.welcome": "Bienvenue", "step.import": "Favoris", "step.appearance": "Apparence", "step.review": "Vérification",
  "import.title": "Importez vos favoris ou repartez de zéro", "import.body": "Aucune donnée n’est écrite avant la fin.", "import.default.title": "Commencer avec Asterfold", "import.default.body": "Conserver l’espace initial. L’import restera disponible dans les Réglages.",
  "import.chrome.title": "Importer depuis Chrome", "import.chrome.body": "Copier l’arborescence sans modifier les favoris d’origine.", "import.chrome.permission": "Chrome demandera un accès temporaire uniquement après votre clic. Le traitement reste local.", "import.chrome.denied": "L’accès n’a pas été accordé. Choisissez une autre source ou réessayez.",
  "import.html.title": "Importer un fichier HTML", "import.html.body": "Choisissez un fichier Netscape exporté par un navigateur.", "import.backup.title": "Restaurer une sauvegarde Asterfold", "import.backup.body": "Validez et prévisualisez la sauvegarde JSON avant application.",
  "appearance.title": "Choisissez l’apparence initiale", "appearance.body": "Les changements restent un aperçu jusqu’à la fin.", "appearance.preset": "Thème", "appearance.density": "Densité", "appearance.compact": "Compacte", "appearance.comfortable": "Confortable", "appearance.spacious": "Aérée", "appearance.rows": "Lignes de l’espace",
  "review.title": "Vérifiez la configuration", "review.body": "Asterfold appliquera les choix en une opération contrôlée.", "action.continue": "Continuer", "action.back": "Retour", "action.finish": "Terminer la configuration", "action.finishing": "Finalisation…", "action.skip": "Ignorer la configuration", "action.retry": "Réessayer",
  "skip.title": "Ignorer la configuration guidée ?", "skip.body": "Asterfold conservera les valeurs par défaut. Vous pourrez importer et personnaliser plus tard.", "skip.continue": "Poursuivre la configuration", "skip.confirm": "Ignorer et utiliser les valeurs par défaut", "status.ready": "Configuration terminée", "status.error": "La configuration a échoué. L’espace précédent a été restauré."
};

const it: Dictionary = { ...en,
  "greeting.morning": "Buongiorno", "greeting.afternoon": "Buon pomeriggio", "greeting.evening": "Buonasera",
  "welcome.title": "Benvenuto in Asterfold", "welcome.body": "Configura in pochi passaggi uno spazio visivo per preferiti privato e locale.", "welcome.privacy": "I dati restano in questo profilo del browser. Nessun account e nessuna analisi.", "welcome.language": "Lingua dell’interfaccia",
  "step.welcome": "Benvenuto", "step.import": "Preferiti", "step.appearance": "Aspetto", "step.review": "Riepilogo",
  "import.title": "Importa i preferiti o inizia da zero", "import.body": "Nessun dato viene scritto prima della conferma finale.", "import.default.title": "Inizia con Asterfold", "import.default.body": "Mantieni lo spazio iniziale. Potrai importare in seguito dalle Impostazioni.",
  "import.chrome.title": "Importa da Chrome", "import.chrome.body": "Copia l’albero dei preferiti senza modificare gli originali.", "import.chrome.permission": "Chrome chiederà accesso temporaneo solo dopo il clic. L’elaborazione è locale.", "import.chrome.denied": "Accesso non concesso. Scegli un’altra fonte o riprova.",
  "import.html.title": "Importa HTML dei preferiti", "import.html.body": "Scegli un file Netscape esportato da un browser.", "import.backup.title": "Ripristina backup Asterfold", "import.backup.body": "Convalida e visualizza il backup JSON prima di applicarlo.",
  "appearance.title": "Scegli l’aspetto iniziale", "appearance.body": "Le modifiche restano un’anteprima fino alla fine.", "appearance.preset": "Tema", "appearance.density": "Densità", "appearance.compact": "Compatta", "appearance.comfortable": "Comoda", "appearance.spacious": "Spaziosa", "appearance.rows": "Righe dello spazio",
  "review.title": "Controlla la configurazione", "review.body": "Asterfold applicherà tutto in un’unica operazione controllata.", "action.continue": "Continua", "action.back": "Indietro", "action.finish": "Termina configurazione", "action.finishing": "Completamento…", "action.skip": "Salta configurazione", "action.retry": "Riprova",
  "skip.title": "Saltare la configurazione guidata?", "skip.body": "Asterfold manterrà i valori predefiniti. Potrai importare e personalizzare in seguito.", "skip.continue": "Continua configurazione", "skip.confirm": "Salta e usa i valori predefiniti", "status.ready": "Configurazione completata", "status.error": "Configurazione non riuscita. Lo spazio precedente è stato ripristinato."
};

const pt: Dictionary = { ...en,
  "greeting.morning": "Bom dia", "greeting.afternoon": "Boa tarde", "greeting.evening": "Boa noite",
  "welcome.title": "Bem-vindo ao Asterfold", "welcome.body": "Configure em poucos passos um espaço visual de favoritos privado e local.", "welcome.privacy": "Os seus dados permanecem neste perfil do navegador. Sem conta e sem análises.", "welcome.language": "Idioma da interface",
  "step.welcome": "Boas-vindas", "step.import": "Favoritos", "step.appearance": "Aparência", "step.review": "Revisão",
  "import.title": "Importe favoritos ou comece do zero", "import.body": "Nada é gravado antes de concluir a configuração.", "import.default.title": "Começar com Asterfold", "import.default.body": "Mantenha o espaço inicial. Poderá importar depois nas Definições.",
  "import.chrome.title": "Importar do Chrome", "import.chrome.body": "Copie a árvore de favoritos sem alterar os originais.", "import.chrome.permission": "O Chrome pedirá acesso temporário apenas após clicar. O processamento é local.", "import.chrome.denied": "O acesso não foi concedido. Escolha outra fonte ou tente novamente.",
  "import.html.title": "Importar HTML de favoritos", "import.html.body": "Escolha um ficheiro Netscape exportado por um navegador.", "import.backup.title": "Restaurar cópia do Asterfold", "import.backup.body": "Valide e pré-visualize a cópia JSON antes de aplicar.",
  "appearance.title": "Escolha a aparência inicial", "appearance.body": "As alterações são apenas pré-visualização até concluir.", "appearance.preset": "Tema", "appearance.density": "Densidade", "appearance.compact": "Compacta", "appearance.comfortable": "Confortável", "appearance.spacious": "Espaçosa", "appearance.rows": "Linhas do espaço",
  "review.title": "Reveja a configuração", "review.body": "O Asterfold aplicará tudo numa operação controlada.", "action.continue": "Continuar", "action.back": "Voltar", "action.finish": "Concluir configuração", "action.finishing": "A concluir…", "action.skip": "Ignorar configuração", "action.retry": "Tentar novamente",
  "skip.title": "Ignorar a configuração guiada?", "skip.body": "O Asterfold manterá os valores predefinidos. Poderá importar e personalizar depois.", "skip.continue": "Continuar configuração", "skip.confirm": "Ignorar e usar predefinições", "status.ready": "Configuração concluída", "status.error": "Não foi possível concluir. O espaço anterior foi restaurado."
};

const pl: Dictionary = { ...en,
  "greeting.morning": "Dzień dobry", "greeting.afternoon": "Dzień dobry", "greeting.evening": "Dobry wieczór",
  "welcome.title": "Witamy w Asterfold", "welcome.body": "Skonfiguruj w kilku krokach prywatny, lokalny obszar zakładek.", "welcome.privacy": "Dane pozostają w tym profilu przeglądarki. Bez konta i analityki.", "welcome.language": "Język interfejsu",
  "step.welcome": "Witamy", "step.import": "Zakładki", "step.appearance": "Wygląd", "step.review": "Podsumowanie",
  "import.title": "Przenieś zakładki lub zacznij od nowa", "import.body": "Do zakończenia konfiguracji nic nie zostanie zapisane.", "import.default.title": "Zacznij z Asterfold", "import.default.body": "Zachowaj obszar startowy. Import będzie dostępny później w Ustawieniach.",
  "import.chrome.title": "Importuj z Chrome", "import.chrome.body": "Skopiuj drzewo zakładek bez zmieniania oryginałów.", "import.chrome.permission": "Chrome poprosi o tymczasowy dostęp dopiero po kliknięciu. Przetwarzanie jest lokalne.", "import.chrome.denied": "Nie przyznano dostępu. Wybierz inne źródło lub spróbuj ponownie.",
  "import.html.title": "Importuj HTML zakładek", "import.html.body": "Wybierz plik Netscape wyeksportowany z przeglądarki.", "import.backup.title": "Przywróć kopię Asterfold", "import.backup.body": "Zweryfikuj i obejrzyj kopię JSON przed zastosowaniem.",
  "appearance.title": "Wybierz początkowy wygląd", "appearance.body": "Zmiany są podglądem do zakończenia konfiguracji.", "appearance.preset": "Motyw", "appearance.density": "Gęstość", "appearance.compact": "Kompaktowa", "appearance.comfortable": "Wygodna", "appearance.spacious": "Przestronna", "appearance.rows": "Wiersze obszaru",
  "review.title": "Sprawdź konfigurację", "review.body": "Asterfold zastosuje ustawienia w jednej kontrolowanej operacji.", "action.continue": "Dalej", "action.back": "Wstecz", "action.finish": "Zakończ konfigurację", "action.finishing": "Kończenie…", "action.skip": "Pomiń konfigurację", "action.retry": "Spróbuj ponownie",
  "skip.title": "Pominąć konfigurację krok po kroku?", "skip.body": "Asterfold zachowa wartości domyślne. Import i personalizacja będą dostępne później.", "skip.continue": "Kontynuuj konfigurację", "skip.confirm": "Pomiń i użyj domyślnych", "status.ready": "Konfiguracja zakończona", "status.error": "Konfiguracja nie powiodła się. Przywrócono poprzedni obszar."
};

const uk: Dictionary = { ...en,
  "greeting.morning": "Доброго ранку", "greeting.afternoon": "Добрий день", "greeting.evening": "Добрий вечір",
  "welcome.title": "Ласкаво просимо до Asterfold", "welcome.body": "Налаштуйте приватний локальний простір закладок за кілька кроків.", "welcome.privacy": "Дані залишаються в цьому профілі браузера. Без облікового запису й аналітики.", "welcome.language": "Мова інтерфейсу",
  "step.welcome": "Вітання", "step.import": "Закладки", "step.appearance": "Оформлення", "step.review": "Перевірка",
  "import.title": "Перенесіть закладки або почніть заново", "import.body": "До завершення налаштування дані не записуються.", "import.default.title": "Почати з Asterfold", "import.default.body": "Залишити початковий простір. Імпорт буде доступний пізніше в Налаштуваннях.",
  "import.chrome.title": "Імпортувати з Chrome", "import.chrome.body": "Скопіювати дерево закладок, не змінюючи оригінали.", "import.chrome.permission": "Chrome попросить тимчасовий доступ лише після натискання. Обробка локальна.", "import.chrome.denied": "Доступ не надано. Виберіть інше джерело або повторіть.",
  "import.html.title": "Імпортувати HTML закладок", "import.html.body": "Виберіть файл Netscape, експортований із браузера.", "import.backup.title": "Відновити копію Asterfold", "import.backup.body": "Перевірте й перегляньте JSON-копію перед застосуванням.",
  "appearance.title": "Виберіть початковий вигляд", "appearance.body": "Зміни залишаються попереднім переглядом до завершення.", "appearance.preset": "Тема", "appearance.density": "Щільність", "appearance.compact": "Компактна", "appearance.comfortable": "Зручна", "appearance.spacious": "Простора", "appearance.rows": "Ряди простору",
  "review.title": "Перевірте налаштування", "review.body": "Asterfold застосує вибір однією контрольованою операцією.", "action.continue": "Продовжити", "action.back": "Назад", "action.finish": "Завершити налаштування", "action.finishing": "Завершення…", "action.skip": "Пропустити налаштування", "action.retry": "Повторити",
  "skip.title": "Пропустити покрокове налаштування?", "skip.body": "Asterfold збереже стандартні параметри. Імпорт і персоналізація будуть доступні пізніше.", "skip.continue": "Продовжити налаштування", "skip.confirm": "Пропустити й використати стандартні", "status.ready": "Налаштування завершено", "status.error": "Не вдалося завершити. Попередній простір відновлено."
};

const tr: Dictionary = { ...en,
  "greeting.morning": "Günaydın", "greeting.afternoon": "İyi günler", "greeting.evening": "İyi akşamlar",
  "welcome.title": "Asterfold’a hoş geldiniz", "welcome.body": "Özel ve yerel görsel yer imi alanını birkaç adımda kurun.", "welcome.privacy": "Veriler bu tarayıcı profilinde kalır. Hesap ve analiz yoktur.", "welcome.language": "Arayüz dili",
  "step.welcome": "Hoş geldiniz", "step.import": "Yer imleri", "step.appearance": "Görünüm", "step.review": "İnceleme",
  "import.title": "Yer imlerini aktarın veya sıfırdan başlayın", "import.body": "Kurulum bitene kadar hiçbir veri yazılmaz.", "import.default.title": "Asterfold ile başla", "import.default.body": "Başlangıç alanını koruyun. Daha sonra Ayarlar’dan içe aktarabilirsiniz.",
  "import.chrome.title": "Chrome’dan içe aktar", "import.chrome.body": "Orijinalleri değiştirmeden yer imi ağacını kopyalayın.", "import.chrome.permission": "Chrome yalnızca düğmeye bastıktan sonra geçici erişim ister. İşleme yereldir.", "import.chrome.denied": "Erişim verilmedi. Başka bir kaynak seçin veya tekrar deneyin.",
  "import.html.title": "Yer imi HTML’sini içe aktar", "import.html.body": "Tarayıcıdan dışa aktarılmış Netscape dosyasını seçin.", "import.backup.title": "Asterfold yedeğini geri yükle", "import.backup.body": "JSON yedeğini uygulamadan önce doğrulayın ve önizleyin.",
  "appearance.title": "Başlangıç görünümünü seçin", "appearance.body": "Değişiklikler kurulum bitene kadar önizlemedir.", "appearance.preset": "Tema", "appearance.density": "Yoğunluk", "appearance.compact": "Kompakt", "appearance.comfortable": "Rahat", "appearance.spacious": "Geniş", "appearance.rows": "Çalışma alanı satırları",
  "review.title": "Kurulumu gözden geçirin", "review.body": "Asterfold seçimleri tek kontrollü işlemde uygular.", "action.continue": "Devam", "action.back": "Geri", "action.finish": "Kurulumu tamamla", "action.finishing": "Tamamlanıyor…", "action.skip": "Kurulumu atla", "action.retry": "Tekrar dene",
  "skip.title": "Yönlendirmeli kurulum atlansın mı?", "skip.body": "Asterfold varsayılanları korur. Daha sonra içe aktarabilir ve özelleştirebilirsiniz.", "skip.continue": "Kuruluma devam et", "skip.confirm": "Atla ve varsayılanları kullan", "status.ready": "Kurulum tamamlandı", "status.error": "Kurulum tamamlanamadı. Önceki alan geri yüklendi."
};

const nl: Dictionary = { ...en,
  "greeting.morning": "Goedemorgen", "greeting.afternoon": "Goedemiddag", "greeting.evening": "Goedenavond",
  "welcome.title": "Welkom bij Asterfold", "welcome.body": "Stel in enkele stappen een privé, lokale visuele bladwijzerwerkruimte in.", "welcome.privacy": "Je gegevens blijven in dit browserprofiel. Geen account en geen analytics.", "welcome.language": "Interfacetaal",
  "step.welcome": "Welkom", "step.import": "Bladwijzers", "step.appearance": "Weergave", "step.review": "Controleren",
  "import.title": "Neem bladwijzers mee of begin opnieuw", "import.body": "Er wordt niets geschreven voordat de installatie is voltooid.", "import.default.title": "Start met Asterfold", "import.default.body": "Behoud de startwerkruimte. Importeren kan later via Instellingen.",
  "import.chrome.title": "Importeren uit Chrome", "import.chrome.body": "Kopieer de bladwijzerstructuur zonder de originelen te wijzigen.", "import.chrome.permission": "Chrome vraagt pas na je klik om tijdelijke toegang. Verwerking gebeurt lokaal.", "import.chrome.denied": "Toegang is niet verleend. Kies een andere bron of probeer opnieuw.",
  "import.html.title": "Bladwijzer-HTML importeren", "import.html.body": "Kies een Netscape-bestand dat door een browser is geëxporteerd.", "import.backup.title": "Asterfold-back-up herstellen", "import.backup.body": "Valideer en bekijk de JSON-back-up voordat je deze toepast.",
  "appearance.title": "Kies de beginweergave", "appearance.body": "Wijzigingen blijven een voorbeeld tot de afronding.", "appearance.preset": "Thema", "appearance.density": "Dichtheid", "appearance.compact": "Compact", "appearance.comfortable": "Comfortabel", "appearance.spacious": "Ruim", "appearance.rows": "Werkruimterijen",
  "review.title": "Controleer de installatie", "review.body": "Asterfold past alles toe in één gecontroleerde bewerking.", "action.continue": "Doorgaan", "action.back": "Terug", "action.finish": "Installatie afronden", "action.finishing": "Afronden…", "action.skip": "Installatie overslaan", "action.retry": "Opnieuw proberen",
  "skip.title": "Begeleide installatie overslaan?", "skip.body": "Asterfold behoudt de standaardwaarden. Importeren en aanpassen kan later.", "skip.continue": "Installatie voortzetten", "skip.confirm": "Overslaan en standaardwaarden gebruiken", "status.ready": "Installatie voltooid", "status.error": "Installatie mislukt. De vorige werkruimte is hersteld."
};

const dictionaries: Record<AppLocale, Dictionary> = { en, ru, kk, es, de, fr, it, pt, pl, uk, tr, nl };

export function resolveOnboardingLocale(preference: LocalePreference): AppLocale {
  if (preference !== "auto") return preference;
  const chromeLocale = typeof chrome !== "undefined" && chrome.i18n?.getUILanguage ? chrome.i18n.getUILanguage() : "";
  const language = (chromeLocale || (typeof navigator !== "undefined" ? navigator.language : "en")).toLowerCase().split("-")[0] ?? "en";
  return language in dictionaries ? language as AppLocale : "en";
}

export function onboardingText(
  preference: LocalePreference,
  key: OnboardingMessageKey,
  params: Record<string, string | number> = {},
): string {
  const template = dictionaries[resolveOnboardingLocale(preference)][key] ?? en[key];
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), template);
}
