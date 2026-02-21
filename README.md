# der_die_das_data

## Скрипт: split_translation_csv_chunks.mjs

Разбивает один CSV на чанки и сохраняет их в отдельные файлы.

Что делает:
- читает исходный CSV;
- корректно режет по записям (учитывает кавычки, запятые и переносы строк внутри полей);
- добавляет заголовок (header) в каждый чанк;
- очищает папку чанков перед генерацией новых файлов;
- записывает чанки в `--out-dir`.

Запуск:
```bash
node scripts/split_translation_csv_chunks.mjs --input language-packs/ru/word_ru.csv --out-dir language-packs/ru/chunks --prefix word_ru
node scripts/split_translation_csv_chunks.mjs --input language-packs/en/word_en.csv --out-dir language-packs/en/chunks --prefix word_en
```

Параметры:
- `--input` путь к исходному CSV;
- `--out-dir` директория для чанков;
- `--chunk-size` число строк данных в одном чанке (по умолчанию `500`);
- `--prefix` префикс имени файла (по умолчанию `chunk`).

Пример выходных файлов:
- `word_ru-001.csv`
- `word_ru-002.csv`

## Скрипт: generate_language_packs_manifest.mjs

Генерирует или обновляет `manifest.json` по папкам языков в `language-packs`.

Ожидаемая структура:
- `<root>/<lang>/version.txt`
- `<root>/<lang>/chunks/*.csv`

Запуск:
```bash
node scripts/generate_language_packs_manifest.mjs --root language-packs
```

С дополнительными параметрами:
```bash
node scripts/generate_language_packs_manifest.mjs --root language-packs --manifest manifest.json --format-version 1 --path-prefix language-packs
```

Параметры:
- `--root` корневая директория языковых пакетов (по умолчанию `language-packs`);
- `--manifest` путь/имя manifest-файла (по умолчанию `manifest.json`);
- `--format-version` версия формата манифеста (по умолчанию `1`);
- `--path-prefix` префикс в путях до чанков внутри манифеста (по умолчанию берётся имя `root`).
