// Render helpers: pure functions returning HTML strings (no side effects).
import { CATEGORIES } from "./allocation.js";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (n) => `${Number(n || 0).toFixed(2)}%`;

const CATEGORY_SLUG = {
  "Ações Nacionais": "an",
  "Ações Internacionais": "ai",
  "Fundos Imobiliários": "fii",
  REITs: "reit",
  "Renda Fixa": "rf",
  "Renda Fixa Internacional": "rfi",
  Criptomoedas: "cripto",
};
const slug = (cat) => CATEGORY_SLUG[cat] || "other";

// Colored bars: fill = current %, dark tick = target %.
export function renderAllocation(current, targets) {
  const rows = current.categories
    .filter((c) => c.value > 0 || (targets[c.category] || 0) > 0)
    .map((c) => {
      const target = targets[c.category] || 0;
      return `<div class="alloc-row">
        <span class="alloc-label">${esc(c.category)}</span>
        <span class="alloc-track"><span class="alloc-fill c-${slug(c.category)}" style="width:${Math.min(c.pct, 100)}%"></span><span class="alloc-target" style="left:${Math.min(target, 100)}%"></span></span>
        <span class="alloc-val">${fmtPct(c.pct)}</span>
      </div>`;
    })
    .join("");
  return `<div class="alloc">${rows || "<p class='msg'>Sem ativos ainda.</p>"}</div>
    <p class="alloc-note">Barra = atual · marca escura = meta · Total: ${fmtMoney(current.total)}</p>`;
}

export function renderTargets(targets) {
  return `<div class="targets-grid">${CATEGORIES.map((cat) => `<label class="target-item">
      <span>${esc(cat)}</span>
      <input type="number" min="0" max="100" step="0.1" data-target-category="${esc(cat)}" value="${targets[cat] || 0}">
    </label>`).join("")}</div>`;
}

export function renderCaps(caps) {
  if (!caps.length) return "<p class='msg'>Nenhum teto definido.</p>";
  return `<table><thead><tr><th>Categoria</th><th>Subcategoria</th><th>Máx %</th><th></th></tr></thead><tbody>${caps
    .map((cap) => `<tr>
      <td>${esc(cap.category)}</td><td>${esc(cap.subcategory)}</td><td>${fmtPct(cap.max_pct)}</td>
      <td><button class="link-danger" data-del-cap data-category="${esc(cap.category)}" data-subcategory="${esc(cap.subcategory)}">remover</button></td>
    </tr>`).join("")}</tbody></table>`;
}

function assetRows(items) {
  return items
    .map(
      (a) => `<tr>
      <td>${esc(a.name)}</td>
      <td><input class="cell-num" type="number" min="0" step="0.01" data-asset-id="${esc(a.id)}" data-field="value" value="${Number(a.value || 0)}"></td>
      <td><input class="cell-num" type="number" min="-1" max="10" step="1" data-asset-id="${esc(a.id)}" data-field="nota" value="${a.nota}"></td>
      <td>${esc(a.subcategory || "")}</td><td>${esc(a.subsubcategory || "")}</td>
      <td><button class="link-danger" data-del-asset="${esc(a.id)}">remover</button></td>
    </tr>`,
    )
    .join("");
}

function assetTable(items) {
  return `<div class="table-wrap"><table><thead><tr>
      <th>Nome</th><th>Valor</th><th>Nota</th><th>Subcat.</th><th>Subsub.</th><th></th>
    </tr></thead><tbody>${assetRows(items)}</tbody></table></div>`;
}

// Grouped by category (in CATEGORIES order); value & nota are editable inline.
export function renderAssets(assets) {
  if (!assets.length) return "<p class='msg'>Nenhum ativo cadastrado.</p>";

  const known = new Set(CATEGORIES);
  const groups = CATEGORIES.map((cat) => ({
    cat,
    items: assets.filter((a) => a.category === cat),
  })).filter((g) => g.items.length);

  const orphans = assets.filter((a) => !known.has(a.category));
  if (orphans.length) groups.push({ cat: "(sem categoria)", items: orphans });

  return groups
    .map((g) => {
      const subtotal = g.items.reduce((s, a) => s + Number(a.value || 0), 0);
      return `<div class="cat-group">
        <h3 class="cat-h">${esc(g.cat)} <small>${fmtMoney(subtotal)} · ${g.items.length} ativo(s)</small></h3>
        ${assetTable(g.items)}
      </div>`;
    })
    .join("");
}

// Import preview: parsed rows + the merge plan (created/updated) computed by csv.js.
export function renderImportPreview(parsed, plan) {
  if (parsed.fatal) return `<p class="msg err">${esc(parsed.fatal)}</p>`;
  if (!parsed.rows.length) return "<p class='msg'>Nada para importar.</p>";

  const existingNames = new Set(plan.existingNorm || []);
  const body = parsed.rows
    .map((r) => {
      let status;
      let cls;
      if (!r.ok) {
        status = "erro";
        cls = "imp-err";
      } else if (existingNames.has(r._norm)) {
        status = "atualiza";
        cls = "imp-upd";
      } else {
        status = "novo";
        cls = "imp-new";
      }
      return `<tr class="${cls}">
        <td>${status}</td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.category || "")}</td>
        <td>${r.ok ? fmtMoney(r.value) : "—"}</td>
        <td>${r.ok ? r.nota : "—"}</td>
        <td class="imp-notes">${esc((r.notes || []).join("; "))}</td>
      </tr>`;
    })
    .join("");

  const summary = `<p class="msg">Novos: <b>${plan.created}</b> · Atualiza: <b>${plan.updated}</b>${
    plan.skipped ? ` · Ignorados (erro): <b>${plan.skipped}</b>` : ""
  }${plan.duplicates ? ` · Repetidos no CSV (último vale): <b>${plan.duplicates}</b>` : ""}</p>`;

  return `${summary}<div class="table-wrap"><table class="imp-table"><thead><tr>
      <th>Status</th><th>Nome</th><th>Categoria</th><th>Valor</th><th>Nota</th><th>Obs.</th>
    </tr></thead><tbody>${body}</tbody></table></div>`;
}

// Aporte suggestion: up to `maxAssets` rows, amounts summing to the aporte.
export function renderAporte(sug) {
  if (!sug.items.length) return `<p class="msg">${esc(sug.note || "Sem sugestão.")}</p>`;
  const rows = sug.items
    .map(
      (it) => `<tr>
      <td>${esc(it.name)}</td>
      <td><span class="chip c-${slug(it.category)}">${esc(it.category)}</span></td>
      <td class="num">${it.nota}</td>
      <td class="num">${fmtMoney(it.amount)}</td>
      <td class="num">${fmtPct(it.pct)}</td>
    </tr>`,
    )
    .join("");
  return `<div class="table-wrap"><table><thead><tr>
      <th>Ativo</th><th>Categoria</th><th>Nota</th><th>Aportar</th><th>% do aporte</th>
    </tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td colspan="3">Total</td><td class="num">${fmtMoney(sug.aporte)}</td><td class="num">100,00%</td></tr></tfoot>
    </table></div>${sug.note ? `<p class="msg">${esc(sug.note)}</p>` : ""}`;
}

export const optionsHtml = (list, selected) =>
  list.map((v) => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");
