# der_die_das_data

- scripts/split_translation_csv_chunks.mjs

  Что делает:

    - читает CSV,
    - корректно режет по записям (поддерживает запятые/кавычки/переносы внутри полей),
    - добавляет header в каждый чанк,
    - пишет чанки в указанную папку.

  Как запускать:

  node scripts/split_translation_csv_chunks.mjs  --input language-packs/ru/v1/word_ru.csv --out-dir language-packs/ru/v1/chunks/ --chunk-size 100 --prefix word_ru
  node scripts/split_translation_csv_chunks.mjs  --input language-packs/en/v1/word_en.csv --out-dir language-packs/en/v1/chunks/ --chunk-size 100 --prefix word_en

  Параметры:

    - --input путь к CSV
    - --out-dir куда писать чанки
    - --chunk-size строк на файл (по умолчанию 100)
    - --prefix префикс файлов (по умолчанию chunk)

  Пример имен файлов:

    - word_ru-001.csv
    - word_ru-002.csv