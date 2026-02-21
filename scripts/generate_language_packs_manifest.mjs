#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    root: "language-packs",
    manifest: "manifest.json",
    formatVersion: 1,
    pathPrefix: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];

    if (key === "--root" && value) {
      args.root = value;
      i += 1;
      continue;
    }
    if (key === "--manifest" && value) {
      args.manifest = value;
      i += 1;
      continue;
    }
    if (key === "--format-version" && value) {
      args.formatVersion = Number.parseInt(value, 10);
      i += 1;
      continue;
    }
    if (key === "--path-prefix" && value) {
      args.pathPrefix = value;
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
  console.log([
    "Generate/update language-packs manifest.json from language folders.",
    "",
    "Expected structure:",
    "  <root>/<lang>/version.txt",
    "  <root>/<lang>/chunks/*.csv",
    "",
    "Usage:",
    "  node scripts/generate_language_packs_manifest.mjs [--root language-packs] [--manifest manifest.json] [--format-version 1] [--path-prefix language-packs]",
    "",
    "Options:",
    "  --root            Path to language packs root (default: language-packs)",
    "  --manifest        Manifest file name/path relative to root if not absolute (default: manifest.json)",
    "  --format-version  Manifest formatVersion (default: 1)",
    "  --path-prefix     Prefix used in chunk paths. Default = basename(root).",
    "  --help, -h        Show help",
  ].join("\n"));
}

function toPosixPath(...parts) {
  return path.posix.join(...parts.map(part => String(part).replaceAll("\\", "/")));
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

function getChunkIndex(fileName = "") {
  const match = fileName.match(/-(\d+)\.csv$/i);
  return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

function getChunkIndexPad(fileName = "") {
  const match = fileName.match(/-(\d+)\.csv$/i);
  return match ? match[1].length : 0;
}

async function countCsvDataRows(filePath) {
  const csvText = await fs.readFile(filePath, "utf8");
  const records = splitCsvRecords(csvText);
  if (records.length === 0) {
    return 0;
  }
  return Math.max(0, records.length - 1);
}

async function buildLanguageEntry({ rootPath, langDirent, pathPrefix }) {
  const lang = langDirent.name;
  const langDir = path.join(rootPath, lang);
  const versionPath = path.join(langDir, "version.txt");
  const chunksDir = path.join(langDir, "chunks");

  const version = (await fs.readFile(versionPath, "utf8")).trim();
  if (!version) {
    throw new Error(`Empty version.txt for language: ${ lang }`);
  }

  const chunkDirents = await fs.readdir(chunksDir, { withFileTypes: true });
  const chunkFiles = chunkDirents
    .filter(item => item.isFile() && item.name.toLowerCase().endsWith(".csv"))
    .map(item => item.name);

  if (chunkFiles.length === 0) {
    throw new Error(`No chunk CSV files found for language: ${ lang }`);
  }

  const chunks = [];
  let recordCount = 0;

  for (const fileName of chunkFiles) {
    const filePath = path.join(chunksDir, fileName);
    const records = await countCsvDataRows(filePath);
    const index = getChunkIndex(fileName);
    const relativePath = toPosixPath(pathPrefix, lang, "chunks", fileName);
    const chunkIndexPad = getChunkIndexPad(fileName);

    chunks.push({
      index: Number.isNaN(index) ? null : index,
      path: relativePath,
      records,
      fileName,
      chunkIndexPad,
    });
    recordCount += records;
  }

  chunks.sort((a, b) => {
    const aHasIndex = Number.isInteger(a.index);
    const bHasIndex = Number.isInteger(b.index);
    if (aHasIndex && bHasIndex) {
      return a.index - b.index;
    }
    if (aHasIndex && !bHasIndex) {
      return -1;
    }
    if (!aHasIndex && bHasIndex) {
      return 1;
    }
    return a.path.localeCompare(b.path);
  });

  const hasInvalidChunkName = chunks.some(chunk => !Number.isInteger(chunk.index));
  if (hasInvalidChunkName) {
    throw new Error(`Chunk file name must end with -NNN.csv for language: ${ lang }`);
  }

  const firstChunk = chunks[0];
  const commonPad = firstChunk.chunkIndexPad;
  const hasDifferentPad = chunks.some(chunk => chunk.chunkIndexPad !== commonPad);
  if (hasDifferentPad) {
    throw new Error(`Chunk index padding must be consistent for language: ${ lang }`);
  }

  const chunkPathPattern = firstChunk.path.replace(
    new RegExp(`-(\\d{${ commonPad }})\\.csv$`, "i"),
    "-{index}.csv",
  );
  const chunkSize = chunks.length > 0 ? chunks[0].records : 0;
  const lastChunkRecords = chunks.length > 0 ? chunks[chunks.length - 1].records : 0;

  return {
    lang,
    data: {
      version,
      recordCount,
      chunkCount: chunks.length,
      chunkSize,
      lastChunkRecords,
      chunkPathPattern,
      chunkIndexPad: commonPad,
    },
  };
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }

  if (!Number.isInteger(args.formatVersion) || args.formatVersion <= 0) {
    throw new Error("--format-version must be a positive integer");
  }

  const rootPath = path.resolve(args.root);
  const pathPrefix = args.pathPrefix || path.basename(rootPath);
  const manifestPath = path.isAbsolute(args.manifest)
    ? args.manifest
    : path.join(rootPath, args.manifest);

  const dirents = await fs.readdir(rootPath, { withFileTypes: true });
  const langDirs = dirents
    .filter(item => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const languages = {};
  for (const langDirent of langDirs) {
    const entry = await buildLanguageEntry({ rootPath, langDirent, pathPrefix });
    languages[entry.lang] = entry.data;
  }

  const manifest = {
    formatVersion: args.formatVersion,
    generatedAt: new Date().toISOString(),
    languages,
  };

  await fs.writeFile(
    manifestPath,
    `${ JSON.stringify(manifest, null, 2) }\n`,
    "utf8",
  );

  console.log(JSON.stringify({
    manifest: manifestPath,
    languages: Object.keys(languages),
  }));
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
