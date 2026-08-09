// Data access for portfolios, assets, targets and caps.
// Every call is scoped to the logged-in user by Supabase RLS.
import { supabase } from "./supabase.js";

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

// ---------- Portfolios ----------
export async function listPortfolios() {
  return unwrap(await supabase.from("portfolios").select("*").order("created_at"));
}

export async function createPortfolio(name) {
  // `owner` is filled by the column default (auth.uid()).
  return unwrap(await supabase.from("portfolios").insert({ name }).select().single());
}

export async function deletePortfolio(id) {
  return unwrap(await supabase.from("portfolios").delete().eq("id", id));
}

// ---------- Assets ----------
export async function listAssets(portfolioId) {
  return unwrap(
    await supabase.from("assets").select("*").eq("portfolio_id", portfolioId).order("name"),
  );
}

export async function saveAsset(asset) {
  // asset: { id?, portfolio_id, name, value, nota, category, subcategory?, subsubcategory? }
  return unwrap(await supabase.from("assets").upsert(asset).select().single());
}

export async function updateAsset(id, patch) {
  // Partial update (e.g. inline value/nota edits).
  return unwrap(await supabase.from("assets").update(patch).eq("id", id).select().single());
}

export async function deleteAsset(id) {
  return unwrap(await supabase.from("assets").delete().eq("id", id));
}

// Batch upsert (used by CSV import). Every row is given the same set of columns
// and an `id` (generated for new rows) so the payload is homogeneous — otherwise
// PostgREST may derive columns from the first row and turn updates into inserts.
export async function saveAssets(assets) {
  if (!assets.length) return [];
  const rows = assets.map((a) => ({
    id: a.id ?? crypto.randomUUID(),
    portfolio_id: a.portfolio_id,
    name: a.name,
    value: a.value,
    nota: a.nota,
    category: a.category,
    subcategory: a.subcategory ?? null,
    subsubcategory: a.subsubcategory ?? null,
  }));
  return unwrap(await supabase.from("assets").upsert(rows).select());
}

// ---------- Category targets ----------
export async function listTargets(portfolioId) {
  return unwrap(
    await supabase.from("category_targets").select("*").eq("portfolio_id", portfolioId),
  );
}

export async function saveTarget(portfolioId, category, targetPct) {
  return unwrap(
    await supabase
      .from("category_targets")
      .upsert(
        { portfolio_id: portfolioId, category, target_pct: targetPct },
        { onConflict: "portfolio_id,category" },
      ),
  );
}

// ---------- Subcategory caps ----------
export async function listCaps(portfolioId) {
  return unwrap(
    await supabase.from("subcategory_caps").select("*").eq("portfolio_id", portfolioId),
  );
}

export async function saveCap(portfolioId, category, subcategory, maxPct) {
  return unwrap(
    await supabase
      .from("subcategory_caps")
      .upsert(
        { portfolio_id: portfolioId, category, subcategory, max_pct: maxPct },
        { onConflict: "portfolio_id,category,subcategory" },
      ),
  );
}

export async function deleteCap(portfolioId, category, subcategory) {
  return unwrap(
    await supabase
      .from("subcategory_caps")
      .delete()
      .eq("portfolio_id", portfolioId)
      .eq("category", category)
      .eq("subcategory", subcategory),
  );
}
