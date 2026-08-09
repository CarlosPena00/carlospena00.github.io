// CSV import: pure functions only (KISS over OOP). No I/O, no DOM.
// Accepts pt-BR spreadsheet output: ";" delimiter and "R$ 1.234,56" money.
// Columns are matched by header name (order-independent).

const DELIMS = [";", "\t", ","];

// Header aliases -> canonical field. Matched accent/case-insensitive.
const HEADER_ALIASES = {
  category: ["categoria", "category", "classe"],
  name: ["ticker", "nome", "name", "ativo", "papel"],
  value: ["valor", "value", "total", "valor r$"],
  nota: ["nota", "rating", "grade"],
};

// lowercase, trim, strip accents — for tolerant matching.
export function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function detectDelimiter(headerLine) {
  let best = ";";
  let bestCount = -1;
  for (const d of DELIMS) {
    const n = headerLine.split(d).length;
    if (n > bestCount) {
      bestCount = n;
      best = d;
    }
  }
  return best;
}

// "R$ 38.044,11" -> 38044.11 ; "1842.36" -> 1842.36 ; "" -> NaN.
// If a comma is present it is the decimal separator (dots = thousands);
// otherwise the string is left as-is (dot = decimal).
export function parseBrMoney(raw) {
  let s = String(raw ?? "").replace(/r\$/i, "").replace(/\s/g, "").trim();
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}

// Empty -> 0 (per decision: "não sei"). Clamped to [-1, 10].
function parseNota(raw) {
  const s = String(raw ?? "").trim();
  if (s === "") return { nota: 0, note: "nota vazia → 0" };
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) return { nota: 0, note: `nota inválida "${s}" → 0` };
  if (n < -1) return { nota: -1, note: `nota ${n} → -1` };
  if (n > 10) return { nota: 10, note: `nota ${n} → 10` };
  return { nota: n, note: null };
}

function canonicalCategory(raw, categories) {
  const target = norm(raw);
  return categories.find((c) => norm(c) === target) || null;
}

function buildColumnMap(headerCells) {
  const normalized = headerCells.map(norm);
  const map = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    map[field] = normalized.findIndex((h) => aliases.includes(h));
  }
  return map;
}

// Fixed column order when the paste has NO header row.
const DEFAULT_COLUMNS = { category: 0, name: 1, value: 2, nota: 3 };
const HEADER_TOKENS = new Set(Object.values(HEADER_ALIASES).flat());

// A first line is a header if at least two cells are known header names.
function looksLikeHeader(cells) {
  const hits = cells.map(norm).filter((c) => HEADER_TOKENS.has(c)).length;
  return hits >= 2;
}

// Parse pasted text into normalized rows.
// Returns { delimiter, columns, rows, fatal } where each row is
// { name, value, nota, category, ok, notes[] }. `fatal` is a header-level
// error string (missing required column) or null.
export function parseCsv(text, categories) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!lines.length) return { delimiter: ";", columns: {}, rows: [], fatal: "CSV vazio." };

  const delimiter = detectDelimiter(lines[0]);
  const firstCells = lines[0].split(delimiter);
  const hasHeader = looksLikeHeader(firstCells);

  // With a header, map columns by name (missing required = fatal).
  // Without one, assume the fixed order Categoria; Ticker; Valor; Nota.
  let columns = DEFAULT_COLUMNS;
  if (hasHeader) {
    columns = buildColumnMap(firstCells);
    for (const required of ["category", "name", "value"]) {
      if (columns[required] < 0) {
        return {
          delimiter,
          columns,
          rows: [],
          fatal: `Cabeçalho não encontrado para "${required}". Esperado: Categoria; Ticker; Valor; Nota.`,
        };
      }
    }
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows = dataLines.map((line) => {
    const cells = line.split(delimiter);
    const notes = [];
    let ok = true;

    const name = String(cells[columns.name] ?? "").trim();
    if (!name) {
      ok = false;
      notes.push("nome vazio");
    }

    const rawCat = String(cells[columns.category] ?? "").trim();
    const category = canonicalCategory(rawCat, categories);
    if (!category) {
      ok = false;
      notes.push(`categoria "${rawCat}" não reconhecida`);
    }

    const value = parseBrMoney(cells[columns.value]);
    if (Number.isNaN(value)) {
      ok = false;
      notes.push(`valor inválido "${String(cells[columns.value] ?? "").trim()}"`);
    }

    const notaRaw = columns.nota >= 0 ? cells[columns.nota] : "";
    const { nota, note } = parseNota(notaRaw);
    if (note) notes.push(note);

    return { name, value: Number.isNaN(value) ? 0 : value, nota, category, ok, notes };
  });

  return { delimiter, columns, rows, fatal: null };
}

// Merge by name (accent/case-insensitive) against existing assets.
// Matches -> update value/nota/category, PRESERVE subcategory/subsubcategory.
// New -> insert. Returns { toUpsert, created, updated, skipped }.
export function planImport(rows, existingAssets, portfolioId) {
  const byName = new Map();
  for (const a of existingAssets) byName.set(norm(a.name), a);

  // Dedupe incoming rows by name (last occurrence wins) so a single import never
  // touches the same asset twice — which would break the batch upsert.
  const okByName = new Map();
  let skipped = 0;
  let duplicates = 0;
  for (const r of rows) {
    if (!r.ok) {
      skipped++;
      continue;
    }
    const key = norm(r.name);
    if (okByName.has(key)) duplicates++;
    okByName.set(key, r);
  }

  const toUpsert = [];
  let created = 0;
  let updated = 0;

  for (const r of okByName.values()) {
    const existing = byName.get(norm(r.name));
    if (existing) {
      toUpsert.push({
        id: existing.id,
        portfolio_id: portfolioId,
        name: existing.name, // keep the stored name/casing
        value: r.value,
        nota: r.nota,
        category: r.category,
        subcategory: existing.subcategory ?? null,
        subsubcategory: existing.subsubcategory ?? null,
      });
      updated++;
    } else {
      toUpsert.push({
        portfolio_id: portfolioId,
        name: r.name,
        value: r.value,
        nota: r.nota,
        category: r.category,
        subcategory: null,
        subsubcategory: null,
      });
      created++;
    }
  }

  return { toUpsert, created, updated, skipped, duplicates };
}
