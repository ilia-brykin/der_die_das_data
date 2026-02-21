#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    chunkSize: 100,
    input: "",
    outDir: "",
    prefix: "chunk",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];

    if (key === "--input" && value) {
      args.input = value;
      i += 1;
      continue;
    }
    if (key === "--out-dir" && value) {
      args.outDir = value;
      i += 1;
      continue;
    }
    if (key === "--chunk-size" && value) {
      args.chunkSize = Number.parseInt(value, 10);
      i += 1;
      continue;
    }
    if (key === "--prefix" && value) {
      args.prefix = value;
      i += 1;
      continue;
    }
    if (key === "--help" || key === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${ key }`);
  }

  return args;
}

function printHelp() {
  console.log(
    [
      "Split CSV into chunk files (keeps header in each chunk).",
      "",
      "Usage:",
      "  node scripts/split_translation_csv_chunks.mjs --input <file.csv> --out-dir <dir> [--chunk-size 100] [--prefix chunk]",
      "",
      "Options:",
      "  --input       Path to source CSV",
      "  --out-dir     Target directory for chunk files",
      "  --chunk-size  Rows per chunk (default: 100)",
      "  --prefix      Output file prefix (default: chunk)",
      "  --help, -h    Show this help",
      "",
      "Example:",
      "  node scripts/split_translation_csv_chunks.mjs --input data/versions/1.0.0/translation/word_ru.csv --out-dir data/versions/1.0.0/translation/ru_chunks --chunk-size 100 --prefix word_ru",
    ].join("\n"),
  );
}

function splitCsvRecords(csvText = "") {
  const records = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        // Escaped quote inside quoted field.
        current += "\"\"";
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      if (current.length > 0) {
        records.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    records.push(current);
  }

  return records;
}

function padNumber(value, width) {
  return String(value).padStart(width, "0");
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.input || !args.outDir) {
    printHelp();
    process.exitCode = 1;
    return;
  }
  if (!Number.isInteger(args.chunkSize) || args.chunkSize <= 0) {
    throw new Error("--chunk-size must be a positive integer");
  }

  const inputPath = path.resolve(args.input);
  const outDirPath = path.resolve(args.outDir);

  const csvText = await fs.readFile(inputPath, "utf8");
  const records = splitCsvRecords(csvText);
  if (records.length < 2) {
    throw new Error("CSV must contain header and at least one data row");
  }

  const header = records[0];
  const rows = records.slice(1);
  const totalChunks = Math.ceil(rows.length / args.chunkSize);
  const chunkPad = Math.max(3, String(totalChunks).length);

  await fs.mkdir(outDirPath, { recursive: true });

  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * args.chunkSize;
    const end = start + args.chunkSize;
    const chunkRows = rows.slice(start, end);
    const filename = `${ args.prefix }-${ padNumber(index + 1, chunkPad) }.csv`;
    const outPath = path.join(outDirPath, filename);
    const content = `${ header }\n${ chunkRows.join("\n") }\n`;
    await fs.writeFile(outPath, content, "utf8");
  }

  console.log(
    JSON.stringify({
      chunkSize: args.chunkSize,
      input: inputPath,
      outDir: outDirPath,
      rows: rows.length,
      chunks: totalChunks,
      prefix: args.prefix,
    }),
  );
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
