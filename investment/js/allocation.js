// Pure functions only (KISS over OOP). No side effects, no classes.
// Phase 1 exposes the shared constants and `computeCurrent`.
// The aporte calculator (Phase 2) will add its functions here.

export const CATEGORIES = [
  "Ações Nacionais",
  "Ações Internacionais",
  "Fundos Imobiliários",
  "REITs",
  "Renda Fixa",
  "Renda Fixa Internacional",
  "Criptomoedas",
];

// B3 stock sectors (subcategory) and subsectors (subsubcategory).
export const B3_SECTORS = [
  "Petróleo, Gás e Biocombustíveis",
  "Consumo não Cíclico",
  "Bens Industriais",
  "Financeiro",
  "Consumo Cíclico",
  "Materiais Básicos",
  "Utilidade Pública",
  "Saúde",
  "Tecnologia da Informação",
  "Comunicações",
  "Outros",
];

export const B3_SUBSECTORS = [
  "Armas e Munições", "Serviços de Apoio e Armazenagem", "Produtos para Construção",
  "Transporte Aéreo", "Máq. e Equip. Industriais", "Serviços Diversos",
  "Material Aeronáutico e de Defesa", "Construção Pesada",
  "Máq. e Equip. Construção e Agrícolas", "Transporte Ferroviário", "Transporte Rodoviário",
  "Motores, Compressores e Outros", "Engenharia Consultiva", "Exploração de Rodovias",
  "Transporte Hidroviário", "Material Rodoviário", "Telecomunicações", "Incorporações",
  "Serviços Educacionais", "Vestuário", "Aluguel de carros", "Utensílios Domésticos",
  "Móveis", "Hotelaria", "Produção de Eventos e Shows", "Joalheria",
  "Programas de Fidelização", "Calçados", "Atividades Esportivas", "Brinquedos e Jogos",
  "Fios e Tecidos", "Viagens e Turismo", "Automóveis e Motocicletas", "Produtos Diversos",
  "Restaurante e Similares", "Bicicletas", "Material de Transporte", "Eletrodomésticos",
  "Acessórios", "Alimentos Diversos", "Produtos de Limpeza", "Agricultura",
  "Cervejas e Refrigerantes", "Medicamentos e Outros Produtos", "Açúcar e Álcool",
  "Carnes e Derivados", "Alimentos", "Produtos de Uso Pessoal", "Bancos",
  "Corretoras de Seguros e Resseguros", "Serviços Financeiros Diversos", "Químicos Diversos",
  "Exploração de Imóveis", "Holdings Diversificadas", "Madeira",
  "Gestão de Recursos e Investimentos", "Soc. Crédito e Financiamento",
  "Intermediação Imobiliária", "Seguradoras", "Resseguradoras", "Artefatos de Cobre",
  "Embalagens", "Minerais Metálicos", "Fertilizantes e Defensivos", "Petroquímicos",
  "Materiais Diversos", "Siderurgia", "Artefatos de Ferro e Aço", "Papel e Celulose",
  "Exploração, Refino e Distribuição", "Equipamentos e Serviços", "Equipamentos",
  "Serv. Méd. Hospit., Análises e Diagnósticos", "Computadores e Equipamentos",
  "Programas e Serviços", "Água e Saneamento", "Energia Elétrica", "Gás", "Outros",
];

const RF_INDEXERS = ["IPCA", "SELIC", "PREFIXADO", "Outros"];

// Datalist suggestions per category (free text — user may type anything).
export const SUBCATEGORY_SUGGESTIONS = {
  "Ações Nacionais": B3_SECTORS,
  "Ações Internacionais": B3_SECTORS,
  "Renda Fixa": RF_INDEXERS,
  "Renda Fixa Internacional": RF_INDEXERS,
};

export const SUBSUBCATEGORY_SUGGESTIONS = {
  "Ações Nacionais": B3_SUBSECTORS,
  "Ações Internacionais": B3_SUBSECTORS,
};

// Sum an array of assets by category and return current value + percentage.
// assets: [{ value, category, ... }]
export function computeCurrent(assets) {
  const total = assets.reduce((sum, a) => sum + Number(a.value || 0), 0);

  const valueByCategory = {};
  for (const category of CATEGORIES) valueByCategory[category] = 0;
  for (const a of assets) {
    valueByCategory[a.category] = (valueByCategory[a.category] || 0) + Number(a.value || 0);
  }

  const categories = CATEGORIES.map((category) => {
    const value = valueByCategory[category];
    return { category, value, pct: total > 0 ? (value / total) * 100 : 0 };
  });

  return { total, categories };
}

// ---------- Aporte (contribution) suggestion — Phase 2, pure functions ----------

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Money gap (R$) from each category to its target, measured against the
// post-aporte total. Only underweight categories return a value > 0.
export function categoryGaps(assets, targets, aporte) {
  const current = computeCurrent(assets);
  const newTotal = current.total + Math.max(0, Number(aporte) || 0);
  const valueByCat = {};
  for (const c of current.categories) valueByCat[c.category] = c.value;

  const gaps = {};
  for (const c of CATEGORIES) {
    const targetValue = (Number(targets[c] || 0) / 100) * newTotal;
    gaps[c] = Math.max(0, targetValue - (valueByCat[c] || 0));
  }
  return gaps;
}

// Suggest where to put a contribution. Rules (all locked earlier):
//  - across categories: proportional to the gap (underweight only);
//  - within a category: weighted by nota;
//  - assets with nota <= 0 are excluded (nota -1 "não quero", 0 "não sei");
//  - at most `maxAssets` suggestions (concentrate the aporte);
//  - the suggested amounts sum exactly to the aporte.
// Returns { aporte, items: [{id,name,category,subcategory,nota,amount,pct}], note }.
export function suggestAporte(assets, targets, aporte, maxAssets = 5) {
  const total = Math.max(0, Number(aporte) || 0);
  if (total <= 0) return { aporte: 0, items: [], note: "Informe um valor de aporte." };

  const eligible = assets.filter((a) => Number(a.nota) >= 1);
  if (!eligible.length)
    return { aporte: total, items: [], note: "Nenhum ativo elegível (nota ≥ 1)." };

  const gaps = categoryGaps(assets, targets, total);
  const catsWithEligible = new Set(eligible.map((a) => a.category));

  // Category weight: underweight gap first; if fully balanced, follow targets;
  // if no targets set, weight categories that have eligible assets equally.
  const catWeight = {};
  let sumW = 0;
  for (const c of CATEGORIES) {
    if (!catsWithEligible.has(c)) continue;
    catWeight[c] = gaps[c];
    sumW += gaps[c];
  }
  if (sumW <= 0) {
    for (const c of CATEGORIES) {
      if (!catsWithEligible.has(c)) continue;
      catWeight[c] = Number(targets[c] || 0);
      sumW += catWeight[c];
    }
  }
  if (sumW <= 0) for (const c of catsWithEligible) catWeight[c] = 1;

  // Per-asset weight = category weight * (nota / Σnota within the category).
  const notaByCat = {};
  for (const a of eligible)
    notaByCat[a.category] = (notaByCat[a.category] || 0) + Number(a.nota);

  const weighted = eligible
    .map((a) => {
      const cw = catWeight[a.category] || 0;
      const share = notaByCat[a.category] ? Number(a.nota) / notaByCat[a.category] : 0;
      return { asset: a, weight: cw * share };
    })
    .filter((x) => x.weight > 0);

  if (!weighted.length)
    return {
      aporte: total,
      items: [],
      note: "Nenhuma categoria abaixo da meta com ativos elegíveis.",
    };

  // Concentrate: keep the top `maxAssets` by weight, then split the aporte
  // proportionally among them (so the amounts sum to the aporte).
  weighted.sort((x, y) => y.weight - x.weight);
  const picked = weighted.slice(0, maxAssets);
  const wSum = picked.reduce((s, x) => s + x.weight, 0);

  let items = picked.map((x) => ({
    id: x.asset.id,
    name: x.asset.name,
    category: x.asset.category,
    subcategory: x.asset.subcategory || null,
    nota: Number(x.asset.nota),
    amount: round2((x.weight / wSum) * total),
  }));

  // Fix rounding residue on the largest so the sum is exact.
  const diff = round2(total - items.reduce((s, it) => s + it.amount, 0));
  if (diff !== 0 && items.length) {
    let mi = 0;
    for (let i = 1; i < items.length; i++) if (items[i].amount > items[mi].amount) mi = i;
    items[mi].amount = round2(items[mi].amount + diff);
  }

  items = items.map((it) => ({ ...it, pct: total > 0 ? (it.amount / total) * 100 : 0 }));
  return { aporte: total, items, note: null };
}
