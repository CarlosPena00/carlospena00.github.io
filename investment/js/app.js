// App entry: auth state, data loading and event wiring. KISS, no classes.
import { signIn, signUp, signOut, onAuthChange } from "./auth.js";
import * as db from "./db.js";
import {
  CATEGORIES,
  SUBCATEGORY_SUGGESTIONS,
  SUBSUBCATEGORY_SUGGESTIONS,
  computeCurrent,
  suggestAporte,
} from "./allocation.js";
import { parseCsv, planImport, norm } from "./csv.js";
import * as ui from "./ui.js";

const $ = (id) => document.getElementById(id);

const state = {
  portfolios: [],
  portfolioId: null,
  assets: [],
  targets: {}, // category -> pct
  caps: [],
  importPlan: null, // { toUpsert, created, updated, skipped } from a preview
};

let authMode = "login";

// ---------- Auth ----------
function setAuthMode(mode) {
  authMode = mode;
  document
    .querySelectorAll("[data-auth-tab]")
    .forEach((b) => b.classList.toggle("active", b.dataset.authTab === mode));
  $("auth-submit").textContent = mode === "login" ? "Entrar" : "Criar conta";
  $("auth-password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("auth-msg").textContent = "";
}

document
  .querySelectorAll("[data-auth-tab]")
  .forEach((b) => b.addEventListener("click", () => setAuthMode(b.dataset.authTab)));

$("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const msg = $("auth-msg");
  msg.textContent = "...";
  try {
    const fn = authMode === "login" ? signIn : signUp;
    const res = await fn(email, password);
    if (res.error) throw res.error;
    if (authMode === "signup" && !res.data.session) {
      msg.textContent = "Conta criada! Confirme o link no seu e-mail e depois entre.";
    } else {
      msg.textContent = "";
    }
  } catch (err) {
    msg.textContent = err.message || String(err);
  }
});

$("logout-btn").addEventListener("click", () => signOut());

// ---------- Views ----------
function showAuth() {
  $("auth-view").classList.remove("hidden");
  $("app-view").classList.add("hidden");
  $("user-box").classList.add("hidden");
}
function showApp(user) {
  $("auth-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
  $("user-box").classList.remove("hidden");
  $("username-label").textContent = user.email;
}

// ---------- Data ----------
async function loadPortfolios() {
  state.portfolios = await db.listPortfolios();
  if (!state.portfolios.length) {
    state.portfolios = [await db.createPortfolio("Minha Carteira")];
  }
  state.portfolioId = state.portfolios[0].id;
  renderPortfolioSelect();
  await loadPortfolioData();
}

function renderPortfolioSelect() {
  $("portfolio-select").innerHTML = state.portfolios
    .map(
      (p) =>
        `<option value="${p.id}"${p.id === state.portfolioId ? " selected" : ""}>${ui.esc(p.name)}</option>`,
    )
    .join("");
}

async function loadPortfolioData() {
  const pid = state.portfolioId;
  const [assets, targets, caps] = await Promise.all([
    db.listAssets(pid),
    db.listTargets(pid),
    db.listCaps(pid),
  ]);
  state.assets = assets;
  state.caps = caps;
  state.targets = {};
  for (const t of targets) state.targets[t.category] = Number(t.target_pct);
  renderAll();
}

function targetsSumLabel() {
  const sum = CATEGORIES.reduce((s, c) => s + (state.targets[c] || 0), 0);
  return `Soma das metas: ${sum.toFixed(1)}%${Math.abs(sum - 100) > 0.05 ? " (ideal: 100%)" : " ✓"}`;
}

function renderAllocationBlock() {
  const current = computeCurrent(state.assets);
  $("allocation-view").innerHTML = ui.renderAllocation(current, state.targets);
  $("targets-sum").textContent = targetsSumLabel();
}

function renderAll() {
  renderAllocationBlock();
  $("targets-view").innerHTML = ui.renderTargets(state.targets);
  $("caps-view").innerHTML = ui.renderCaps(state.caps);
  $("assets-view").innerHTML = ui.renderAssets(state.assets);
  $("asset-category").innerHTML = ui.optionsHtml(CATEGORIES, CATEGORIES[0]);
  $("cap-category").innerHTML = ui.optionsHtml(CATEGORIES, CATEGORIES[0]);
  updateSubcatDatalist();
}

function updateSubcatDatalist() {
  const cat = $("asset-category").value;
  const subcats = SUBCATEGORY_SUGGESTIONS[cat] || [];
  const subsubs = SUBSUBCATEGORY_SUGGESTIONS[cat] || [];
  $("subcat-list").innerHTML = subcats.map((v) => `<option value="${ui.esc(v)}">`).join("");
  $("subsub-list").innerHTML = subsubs.map((v) => `<option value="${ui.esc(v)}">`).join("");
}

// ---------- Events ----------
$("portfolio-select").addEventListener("change", async (e) => {
  state.portfolioId = e.target.value;
  await loadPortfolioData();
});

$("new-portfolio-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("new-portfolio-name").value.trim();
  if (!name) return;
  const p = await db.createPortfolio(name);
  state.portfolios.push(p);
  state.portfolioId = p.id;
  $("new-portfolio-name").value = "";
  renderPortfolioSelect();
  await loadPortfolioData();
});

$("asset-category").addEventListener("change", updateSubcatDatalist);

$("aporte-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const aporte = parseFloat($("aporte-value").value);
  if (!(aporte > 0)) {
    $("aporte-result").innerHTML = "<p class='msg'>Informe um valor maior que zero.</p>";
    return;
  }
  const sug = suggestAporte(state.assets, state.targets, aporte, 5);
  $("aporte-result").innerHTML = ui.renderAporte(sug);
});

$("targets-view").addEventListener("change", async (e) => {
  const input = e.target.closest("[data-target-category]");
  if (!input) return;
  const category = input.dataset.targetCategory;
  const pct = Math.max(0, Math.min(100, parseFloat(input.value) || 0));
  state.targets[category] = pct;
  await db.saveTarget(state.portfolioId, category, pct);
  renderAllocationBlock();
});

$("cap-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const category = $("cap-category").value;
  const subcategory = $("cap-subcategory").value.trim();
  const maxPct = parseFloat($("cap-maxpct").value);
  if (!subcategory || Number.isNaN(maxPct)) return;
  await db.saveCap(state.portfolioId, category, subcategory, maxPct);
  $("cap-subcategory").value = "";
  $("cap-maxpct").value = "";
  state.caps = await db.listCaps(state.portfolioId);
  $("caps-view").innerHTML = ui.renderCaps(state.caps);
});

$("caps-view").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del-cap]");
  if (!btn) return;
  await db.deleteCap(state.portfolioId, btn.dataset.category, btn.dataset.subcategory);
  state.caps = await db.listCaps(state.portfolioId);
  $("caps-view").innerHTML = ui.renderCaps(state.caps);
});

$("asset-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const asset = {
    portfolio_id: state.portfolioId,
    name: $("asset-name").value.trim(),
    value: parseFloat($("asset-value").value) || 0,
    nota: parseInt($("asset-nota").value, 10),
    category: $("asset-category").value,
    subcategory: $("asset-subcategory").value.trim() || null,
    subsubcategory: $("asset-subsub").value.trim() || null,
  };
  if (!asset.name || Number.isNaN(asset.nota)) return;
  await db.saveAsset(asset);
  e.target.reset();
  state.assets = await db.listAssets(state.portfolioId);
  renderAll();
});

$("assets-view").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del-asset]");
  if (!btn) return;
  await db.deleteAsset(btn.dataset.delAsset);
  state.assets = await db.listAssets(state.portfolioId);
  renderAll();
});

// Inline edit of value / nota (saves on change; re-renders only allocation to keep focus).
$("assets-view").addEventListener("change", async (e) => {
  const input = e.target.closest("input[data-asset-id]");
  if (!input) return;
  const asset = state.assets.find((a) => String(a.id) === String(input.dataset.assetId));
  if (!asset) return;
  const field = input.dataset.field;

  let patch;
  if (field === "value") {
    const v = parseFloat(input.value);
    if (Number.isNaN(v) || v < 0) return void (input.value = asset.value);
    patch = { value: v };
  } else if (field === "nota") {
    let n = parseInt(input.value, 10);
    if (Number.isNaN(n)) return void (input.value = asset.nota);
    n = Math.max(-1, Math.min(10, n));
    input.value = n;
    patch = { nota: n };
  } else {
    return;
  }

  try {
    await db.updateAsset(asset.id, patch);
    Object.assign(asset, patch);
    renderAllocationBlock();
  } catch (err) {
    input.value = field === "value" ? asset.value : asset.nota;
    alert(err.message || String(err));
  }
});

// ---------- CSV import ----------
$("csv-preview-btn").addEventListener("click", () => {
  const parsed = parseCsv($("csv-input").value, CATEGORIES);
  for (const r of parsed.rows) r._norm = norm(r.name);
  const plan = planImport(parsed.rows, state.assets, state.portfolioId);
  plan.existingNorm = state.assets.map((a) => norm(a.name));
  state.importPlan = plan;
  $("csv-preview").innerHTML = ui.renderImportPreview(parsed, plan);
  $("csv-confirm-btn").disabled = plan.toUpsert.length === 0;
});

$("csv-confirm-btn").addEventListener("click", async (e) => {
  const plan = state.importPlan;
  if (!plan || !plan.toUpsert.length) return;
  e.target.disabled = true;
  try {
    await db.saveAssets(plan.toUpsert);
    state.assets = await db.listAssets(state.portfolioId);
    state.importPlan = null;
    $("csv-input").value = "";
    $("csv-preview").innerHTML = `<p class="msg">Importado: ${plan.created} novo(s), ${plan.updated} atualizado(s).</p>`;
    renderAll();
  } catch (err) {
    $("csv-preview").innerHTML = `<p class="msg err">${ui.esc(err.message || String(err))}</p>`;
    e.target.disabled = false;
  }
});

// ---------- Boot ----------
setAuthMode("login");
onAuthChange(async (user) => {
  if (user) {
    showApp(user);
    try {
      await loadPortfolios();
    } catch (err) {
      $("auth-msg").textContent = err.message || String(err);
    }
  } else {
    showAuth();
  }
});
