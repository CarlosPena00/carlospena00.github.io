---
layout: post
title: "LLM: Laya, a Non-Autoregressive Decision Engine"
author: Carlos Pena
date: 2026-09-24
---

[Laya](https://github.com/NandhaKishorM/laya) (Convai Innovations, Apache 2.0) is a small library that reframes "ask an LLM a yes/no or multiple-choice question" as a classification problem instead of a generation problem. No sampling, no tokens streamed out - one forward pass through a BERT-family encoder, and a probability distribution over your options comes back.

```bash
uv add laya
```

---

## 1. The idea

A typical pattern today is: build a prompt, call a chat model, ask it to answer with a single word or a JSON blob, then parse that string back into a label. That works, but you are paying for autoregressive generation (even a one-word answer still walks through the sampling loop) to solve a problem that is really "which of these N buckets does this text belong to."

Laya's checkpoints are fine-tuned encoders (ModernBERT-large, mmBERT-base) with a classification head, not a causal LM. Three question shapes:

| Type | Answer | Use it for |
|---|---|---|
| `choice` | probability per option | routing, categorization |
| `score` | ordinal rank, 0..N | severity, urgency, quality |
| `noul` | single P(true), 0.0-1.0 | yes/no, risk flags |

```python
from laya import Router

router = Router()  # downloads checkpoints on first use

state = "Hi, we were billed twice for March. Please refund the duplicate today or we will cancel our plan."
questions = {
    "department": {
        "type": "choice",
        "instructions": "Which department should handle this?",
        "criteria": {
            "billing": "invoices, payments, refunds",
            "technical": "bugs, outages, system errors",
            "other": "everything else",
        },
    },
    "urgency": {
        "type": "score",
        "instructions": "How urgent is this?",
        "criteria": ["not urgent", "soon", "blocking"],
    },
    "churn_risk": {
        "type": "noul",
        "instructions": "Does the user threaten to cancel or leave?",
    },
}

result = router.predict(state, questions)
print(result["answers"]["department"]["choice"])  # billing
print(result["answers"]["churn_risk"]["noul"])     # 0.0-1.0
print(result["routing"]["model"])                  # english
```

A built-in `Router` looks at the input's language/script and dispatches to one of three checkpoints: `laya` (English, 421M params, 512 tokens), `laya-multilingual` (mmBERT-base, 322M params, up to 8192 tokens, 100+ languages), or `laya-typed-decisions` (English, domain fine-tuned on classification-style tasks).

---

**Perf.** No GPU handy, so ran the three-question example from section 1 with `%timeit` on CPU only (AMD Ryzen 5 5625U):

```text
522 ms ± 4.46 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```

That first pass actually read 802ms, with a much wider spread. Turned out other applications were competing for the same cores at the time - closing them and re-running twice in a row gave 522ms ± 4.46ms and 525ms ± 4.79ms, consistently, with the std dev dropping from ~16ms to ~5ms. Lesson worth stating plainly: a single wall-clock CPU timing on a normal desktop is not a benchmark, and the fix isn't a fancier flag on `timeit` - it's closing the other applications and rerunning until the number stops moving.

Re-ran everything in this section on a second machine, an Apple M4 Pro (14 cores, laya 0.3.20, torch 2.14), once pinned to CPU and once on the Apple GPU. One gotcha first: on a Mac, `Router()` silently picks MPS when it's available, so a CPU number needs an explicit `Router(device="cpu")`. The same warning about noisy runs applied here too - of four CPU runs, the second came out 10-20% slower across the board, and the third and fourth agreed within ~5%. Numbers below are from the third:

```text
M4 Pro CPU : 139.7 ms ± 4.20 ms
M4 Pro MPS :  39.5 ms ± 2.55 ms
```

3.7x faster than the Ryzen on CPU alone, 13x on the GPU, same answers on all three (`billing`, `churn_risk` 0.879, routed to `english`).

That test had 3 options total across 3 questions. The README warns that high-cardinality `choice` (50+ options) needs "token-budget tuning," so I swept a single `choice` question from 2 to 64 options, same message, `timeit.repeat(repeat=7, number=1)` each time:

```python
def make_questions(n_options: int) -> dict:
    criteria = {f"option_{i}": f"describes item number {i}" for i in range(n_options)}
    return {
        "choice": {
            "type": "choice",
            "instructions": "Pick the option that best matches this message.",
            "criteria": criteria,
        }
    }


for n in [2, 4, 8, 16, 32, 64]:
    questions = make_questions(n)
    result = router.predict(MESSAGE, questions)  # warm-up, also reads input_tokens
    times = timeit.Timer(lambda: router.predict(MESSAGE, questions)).repeat(repeat=7, number=1)
    print(n, result["usage"]["input_tokens"], statistics.mean(times), statistics.stdev(times))
```

| options | input tokens | Ryzen CPU | M4 Pro CPU | M4 Pro MPS |
|---|---|---|---|---|
| 2 | 43 | 254.4 ± 19.40 ms | 71.4 ± 1.70 ms | 19.9 ± 0.50 ms |
| 4 | 61 | 288.4 ± 3.55 ms | 75.5 ± 1.13 ms | 22.6 ± 0.28 ms |
| 8 | 97 | 361.7 ± 6.62 ms | 111.1 ± 6.32 ms | 28.3 ± 1.06 ms |
| 16 | 169 | 517.8 ± 7.82 ms | 137.6 ± 6.56 ms | 35.5 ± 0.26 ms |
| 32 | 185 | 558.9 ± 23.60 ms | 145.8 ± 10.31 ms | 38.2 ± 0.35 ms |
| 64 | 277 | 774.9 ± 7.43 ms | 201.4 ± 5.43 ms | 55.1 ± 0.31 ms |

(Ryzen run with the background load from above already closed - a couple of entries still show a wider std dev than the others. Even a "clean" desktop benchmark isn't a lab bench. The GPU column is the only one with sub-millisecond spread across the board.)

The input token counts are identical on both machines - same tokenizer, same prompt - so the columns are a like-for-like comparison. The M4 CPU runs a steady ~3.3-3.9x faster than the Ryzen, and MPS another ~3.3-3.9x on top of that.

Latency tracks input tokens, not option count directly - the whole `criteria` dict goes into one forward pass, there's no per-option encoding step. 16 -> 32 options barely adds tokens (169 -> 185, since `"describes item number N"` reuses most of its subwords) and latency barely moves (517.8ms -> 558.9ms); 32 -> 64 nearly doubles the token count (185 -> 277) and latency jumps with it (558.9ms -> 774.9ms). The M4 shows the same shape on both devices (137.6 -> 145.8 -> 201.4ms on CPU, 35.5 -> 38.2 -> 55.1ms on MPS), so this is a property of the model, not of one machine. The real lever on cost is criteria text length, not the number of buckets - ten verbose options can cost more than fifty terse ones.

One of these runs also printed a `RuntimeWarning` straight from the library (and it prints again on the M4, at checkpoint load, so it's the checkpoint and not the machine):

```text
laya: this checkpoint ships invalid temperatures or values outside [0.5, 5];
using choice:11+=0.10058280825614929 -> 0.5. Treat confidence from the
affected entries as uncalibrated.
```

Which is the checkpoint itself saying the `confidence` field from section 4 is not trustworthy for every option index on this build - another reason to verify `confidence` against your own labeled data rather than routing on it blindly out of the box.

The benchmark table in the README also claims a "batched throughput" win - ~33-40ms for one question alone on GPU, down to ~7-16ms per question once 10 share a call. That is a different axis than option count: it means stacking more *questions* into one `router.predict()`, not more options inside one question. Worth checking on CPU rather than taking the GPU number on faith - held a fixed 3-option `choice` question per slot, varied how many of them go in one call:

```python
def make_questions(n_questions: int) -> dict:
    base_criteria = {
        "single_product": "wants to buy exactly one specific item",
        "multi_product": "wants several different items for a project",
        "unrelated": "no shopping intent at all",
    }
    return {
        f"question_{i}": {
            "type": "choice",
            "instructions": "What is the customer's intent in this message?",
            "criteria": base_criteria,
        }
        for i in range(n_questions)
    }


for n in [1, 2, 4, 8, 16]:
    questions = make_questions(n)
    result = router.predict(MESSAGE, questions)
    times = timeit.Timer(lambda: router.predict(MESSAGE, questions)).repeat(repeat=7, number=1)
    mean_ms = statistics.mean(times) * 1000
    print(n, result["usage"]["input_tokens"], mean_ms, mean_ms / n)
```

| questions | input tokens | Ryzen CPU | M4 Pro CPU | M4 Pro MPS |
|---|---|---|---|---|
| 1 | 58 | 269.8 ± 6.29 ms | 80.0 ± 2.20 ms | 22.8 ± 0.92 ms |
| 2 | 116 | 385.7 ± 4.99 ms | 123.5 ± 5.07 ms | 30.5 ± 0.24 ms |
| 4 | 232 | 651.8 ± 13.52 ms | 152.6 ± 3.95 ms | 48.2 ± 0.61 ms |
| 8 | 464 | 1212.0 ± 11.10 ms | 251.0 ± 9.26 ms | 94.7 ± 0.24 ms |
| 16 | 928 | 2593.4 ± 26.27 ms | 425.1 ± 7.27 ms | 153.4 ± 0.43 ms |

Divided by question count:

| questions | Ryzen CPU ms/question | M4 Pro CPU ms/question | M4 Pro MPS ms/question |
|---|---|---|---|
| 1 | 269.8 | 80.0 | 22.8 |
| 2 | 192.8 | 61.7 | 15.3 |
| 4 | 162.9 | 38.2 | 12.0 |
| 8 | 151.5 | 31.4 | 11.8 |
| 16 | 162.1 | 26.6 | 9.6 |

On the Ryzen there is a real batching win, just a small one: per-question cost drops from 269.8ms solo to ~151-163ms once 4 or more share a call, roughly 40% - nowhere near the README's ~5x GPU figure, and it plateaus by 4 questions instead of continuing to improve out to 16.

The M4 says that plateau belongs to the Ryzen, not to Laya. On the M4 CPU, per-question cost falls 67% (80.0 -> 26.6ms) and is still dropping at 16 questions; MPS falls 58% (22.8 -> 9.6ms), which lands close to the README's ~7-16ms per question on GPU. My guess is that the 6-core laptop chip is already saturated at 4 questions (232 tokens) while 14 cores and a GPU still have room to spread a longer sequence over. That's an inference, not something I measured. Either way, "how much does batching buy you" depends on the hardware, so measure it on the machine you'll deploy to.

The 16-question row is also the one to distrust the most: `input_tokens` hit 928, comfortably past the 512-token limit the README states for this checkpoint, with no error and no warning printed - same on the M4, CPU and MPS alike. There's no way to tell from the outside whether it silently truncated the tail questions or scored the full sequence anyway - either way, that row is exactly the kind of result the "token-budget tuning" warning is about, and it's worth re-verifying against ground truth before trusting it, not just timing it.

Both sweeps side by side on the Ryzen, log-scaled on count:

<img src="../../../assets/images/laya_perf_scaling.png" alt="Line chart comparing Laya CPU latency as option count grows (2 to 64, one question) versus question count grows (1 to 16, three options each). The option-count line rises gently from ~254ms to ~775ms. The question-count line rises much more steeply, from ~270ms to ~2593ms at 16 questions.">

The two lines make the same point the numbers already did: stacking questions costs far more than stacking options, because the whole batch shares one forward pass and question text doesn't get the token reuse that similarly-worded options do.

Same two sweeps on the M4 Pro, CPU and GPU on one chart:

<img src="../../../assets/images/laya_perf_scaling_m4.png" alt="Line chart of Laya latency on an Apple M4 Pro, CPU (solid lines) versus MPS GPU (dashed lines), log-scaled on count. On CPU, the option-count line rises from ~71ms to ~201ms at 64 options and the question-count line from ~80ms to ~425ms at 16 questions. On MPS, the option-count line rises from ~20ms to ~55ms and the question-count line from ~23ms to ~153ms.">

The shape is the same as on the Ryzen - the question line bends up far faster than the option line on both devices - just lower on CPU: about a quarter of the Ryzen's height at 64 options (201.4 vs. 774.9ms) and a sixth at 16 questions (425.1 vs. 2593.4ms), since that is where the M4's extra cores help most. The GPU compresses everything further: 64 options on MPS (55.1ms) is cheaper than 2 options on the M4 CPU (71.4ms).

---

## 2. Good

**It ships an honest limitations section.** The README documents where it breaks: `noul` sometimes latches onto label wording instead of the input text on English; the multilingual checkpoint shows position bias on `score` questions; high-cardinality `choice` (50+ options) needs token-budget tuning. That kind of self-reported failure mode is rare and useful - it tells you where to add your own eval before trusting it in production.

**Integration surface is wide for a young project.** A FastAPI server with a Jev-API-compatible endpoint (`POST /v1/systemone`), an MCP server for Claude Desktop/Cursor, a LangChain adapter, ONNX export, and a Docker/NixOS deployment path. If you already have infra around one of those, adoption cost is low.

**Structured output is the actual output, not a hopeful parse.** `result["answers"]["department"]["choice"]` is a dict key, not a string you regex out of a completion. No JSON-mode prompt engineering, no retry-on-malformed-output logic.

---

## 3. Bad

**Zero-shot accuracy is close to random off the base checkpoints.** The README's own numbers put base-checkpoint accuracy near 0.36 on specialized tasks before fine-tuning - domain fine-tuning is not optional polish here, it is the difference between a working classifier and noise. Budget for building a labeled set and running the fine-tune notebook before shipping.

**The single external benchmark is one comparison.** 0.766 vs. 0.727 against "TypeSafe's Jev API" is the headline number, but it is one competitor, one dataset, no confidence interval given. Treat it as "plausible, worth reproducing on your own data," not as a settled result.

**Narrow output shapes.** `choice` / `score` / `noul` cover a lot of routing and triage work, but nothing here does extraction, summarization, or open-ended answers - you still need a generative model alongside it for anything that isn't "select from a closed set." Laya is a fast pre-filter/router in front of an LLM, not a replacement for one.

**Young, single-org project.** Convai Innovations, no visible large-scale independent adoption yet. Apache 2.0 means no lock-in risk, but treat checkpoint availability and long-term maintenance the way you would any single-vendor dependency - pin versions, and don't assume the hosted checkpoints stay put.

---

## 4. Where it actually fits

The realistic pattern is a triage layer in front of a chat model, not a replacement for one: classify/route with Laya in single-digit-to-hundreds-of-milliseconds, only pay for a full LLM call on the branch that needs generation. Tried it as an ecommerce intent classifier, zero-shot, no fine-tuning:

```python
from laya import Router

router = Router()

INTENT_QUESTIONS = {
    "intent": {
        "type": "choice",
        "instructions": "What is the customer's intent in this ecommerce message?",
        "criteria": {
            "single_product": "wants to buy or find exactly one specific item, e.g. a gift for someone",
            "multi_product": "wants to furnish, renovate, or equip something and needs several different items, often mentions a budget or project like a room, kitchen, or event",
            "product_question": "is asking a factual question about the specs, features, compatibility, or details of a product, not asking to buy",
            "unrelated": "greetings, small talk, exclamations, profanity, or complaints with no shopping intent at all, e.g. 'hello', 'good day', 'holy shit', swear words",
        },
    },
    "needs_human": {
        "type": "noul",
        "instructions": "Does this message need a human agent instead of an automated reply?",
    },
}


def classify_intent(message: str) -> dict:
    result = router.predict(message, INTENT_QUESTIONS)
    answers = result["answers"]
    return {
        "intent": answers["intent"]["choice"],
        "needs_human": answers["needs_human"]["noul"] >= 0.5,
        "model": result["routing"]["model"],
    }


messages = [
    "I want to buy a present for my son",
    "I want to reform my kitchen, I have 10000 USD to spend",
    "How many USB ports does this notebook have",
    "Hello good day",
    "Holy shit this is broken",
]

for message in messages:
    print(message, "->", classify_intent(message))
```

```text
I want to buy a present for my son -> {'intent': 'single_product', 'needs_human': False, 'model': 'english'}
I want to reform my kitchen, I have 10000 USD to spend -> {'intent': 'unrelated', 'needs_human': False, 'model': 'english'}
How many USB ports does this notebook have -> {'intent': 'product_question', 'needs_human': False, 'model': 'english'}
Hello good day -> {'intent': 'unrelated', 'needs_human': True, 'model': 'english'}
Holy shit this is broken -> {'intent': 'unrelated', 'needs_human': False, 'model': 'english'}
```

Two of five are exactly what section 3 warned about. The kitchen-reform message should have landed on `multi_product` - it has a budget and a project, which is the textbook example in its own criteria string - but got `unrelated` instead. And `needs_human` is flipped: "Hello good day" gets flagged for a human, "Holy shit this is broken" does not. This is the base English checkpoint with zero fine-tuning, which the README already told you sits near chance (~0.36) on out-of-domain tasks - so this is confirmation, not a surprise. Don't ship criteria this specific against the base checkpoint; either fine-tune on your own labeled ecommerce messages or keep the categories close to what it was trained on.

`classify_intent` only surfaces `choice` and `noul`, which hides how unsure the model actually was. The raw `router.predict()` for the kitchen-reform message:

```python
router.predict(message, INTENT_QUESTIONS)
```

```js
{
    "model": "laya-rl-agent", // the decision-engine wrapper, not the checkpoint - see routing.model below
    "answers": {
        "intent": {
            "type": "choice",
            "choice": "unrelated",
            "probabilities": {
                // full distribution, not just the winner - "unrelated" barely beats
                // "single_product" (0.3491 vs 0.3129), all four within 0.23 of each
                // other. classify_intent's argmax throws this away.
                "single_product": 0.3129,
                "multi_product": 0.215,
                "product_question": 0.123,
                "unrelated": 0.3491,
            },
            "confidence": 0.0484, // separate from answer_confidence, and low - collapses when top options are bunched together, like here
            "answer_confidence": 0.3491, // just the chosen option's own probability
            "action": {"act_probability": 1.0}, // RL-agent hook to skip answering outright; 1.0 = it always acted here
        },
        "needs_human": {
            "type": "noul",
            "noul": 0.0466, // P(true)
            "confidence": 0.9534, // high - 0.0466 is decisively close to 0, model is sure (and right, in this instance)
            "answer_confidence": 0.9534,
            "action": {"act_probability": 1.0},
        },
    },
    "usage": {"input_tokens": 198, "output_tokens": 0}, // output_tokens: 0 is the concrete evidence for "no generation" from section 1
    "routing": {
        "model": "english", // the actual checkpoint that scored this text
        "repo": "convaiinnovations/laya",
        "reason": "English Latin text", // log this in production so a misrouted non-English message doesn't fail silently
        "detection": {
            "script": "latin",
            "script_profile": {"latin": 1.0},
            "language": "en",
            "is_english": true,
            "language_undecided": false,
            "diacritic_rate": 0.0,
            "non_latin_fraction": 0.0,
        },
        "workflow": null,
    },
}
```

Take the lesson from `confidence`, not just `choice`: don't build on `classify_intent`'s two-field return in production. Pull `confidence` alongside it, and fall back to the LLM (or a "not sure" branch) whenever it drops below some threshold you tune on your own data - the raw output already tells you which answers not to trust, `classify_intent` was just throwing that signal away.

---

## 5. A real accuracy check

Everything above is anecdote - five messages, one accuracy claim from someone else's benchmark. Built a labeled set to get a real number: 1040 synthetic Portuguese product titles across 8 categories (`eletronicos`, `moveis`, `ferramentas`, `sexshop`, `armas`, `drogas`, `porcelanato`, `eletrodomesticos` - 130 each, templated from brand x product-type x spec), plus a 9th `outros` bucket that no real item maps to, as an escape hatch for "none of the above":

```python
CATEGORIES = {
    "eletronicos": "eletrônicos e informática: celulares, notebooks, tvs, acessórios eletrônicos",
    "moveis": "móveis para casa: sofás, camas, armários, mesas, cadeiras",
    "ferramentas": "ferramentas manuais e elétricas para construção, marcenaria, jardinagem",
    "sexshop": "produtos eróticos e de bem-estar sexual",
    "armas": "armas de pressão, airsoft, facas táticas, coletes e equipamentos de tiro esportivo/defesa",
    "drogas": "substâncias entorpecentes ilícitas",
    "porcelanato": "pisos, revestimentos e porcelanatos para construção civil",
    "eletrodomesticos": "eletrodomésticos: geladeira, fogão, máquina de lavar, ar-condicionado",
    "outros": "qualquer produto que não se encaixe claramente em nenhuma categoria acima",
}
questions = {
    "category": {
        "type": "choice",
        "instructions": "Qual categoria de produto de e-commerce melhor descreve este item?",
        "criteria": CATEGORIES,
    }
}

for product_name, true_category in dataset:  # 1040 rows
    result = router.predict(product_name, questions)
    y_pred.append(result["answers"]["category"]["choice"])
```

Portuguese input never touches the checkpoint used in every example so far. The router itself flags it - `routing.reason`: *"Latin script, language not identified but 3% non-English letters; not safe for the English checkpoint"* - and sends every one of these 1040 calls to `laya-multilingual` (mmBERT-base, 322M) instead of `laya` (ModernBERT-large, 421M). So this is zero-shot accuracy for the *smaller* checkpoint, on a 9-way task neither checkpoint was fine-tuned for:

```text
accuracy      : 0.3990
f1 (macro)    : 0.3304
f1 (weighted) : 0.3718
mcc           : 0.3316
```

With 9 balanced classes, random guessing scores ~11% accuracy - 40% is clearly above chance, but the errors aren't randomly distributed, they're systematic:

| true category | precision | recall | f1 |
|---|---|---|---|
| eletronicos | 0.43 | 0.83 | 0.57 |
| moveis | 0.67 | 0.11 | 0.19 |
| ferramentas | 0.50 | 0.10 | 0.17 |
| sexshop | 0.36 | 0.63 | 0.46 |
| armas | 0.62 | 0.47 | 0.54 |
| drogas | 0.24 | 0.52 | 0.32 |
| porcelanato | 0.65 | 0.39 | 0.49 |
| eletrodomesticos | 0.86 | 0.15 | 0.25 |

Two failure patterns stand out in the confusion matrix:

- **`eletronicos` is the model's default.** 0.83 recall but only 0.43 precision - it absorbs misrouted `ferramentas` and `eletrodomesticos` items rather than committing to the right bucket. `eletrodomesticos` is the mirror image: 0.86 precision but 0.15 recall - when the model does say "eletrodomesticos" it's almost always right, it just rarely says it.
- **`porcelanato` -> `drogas` in 60 of 130 cases (46%).** But mean `confidence` on those 60 is 0.136, against 0.263 on the ones it got right - low enough that a confidence floor would catch most of them. `drogas` -> `sexshop` (54/130, 42%) is the opposite: mean confidence 0.361, *higher* than the 0.313 on correct `drogas` calls. Same fix, applied to two different confusions, works on one and not the other.

Overall, confidence still separates right from wrong on average - 0.415 mean confidence on correct calls vs. 0.225 on incorrect ones - which is the section 4 advice holding up under a thousand-row test, not just one anecdote. The `outros` bucket got picked 30 times out of 1040 (2.9%), thinly spread across categories - it exists, the model uses it sometimes, but it's not a safety net for the two big confusions above: it caught 6 of the 130 misrouted `eletrodomesticos` items and 13 of the 130 `moveis`, nowhere near enough to matter.

Bottom line: this lines up with the "Bad" section's claim that base checkpoints sit near chance out-of-domain, just less dramatically, because 40% is meaningfully above the 11% floor for 9 classes. Zero-shot, unlabeled Portuguese, 9-way retail taxonomy - fine-tuning is not optional here, and `confidence`-based fallback is a real mitigation, not a complete one.

---

## 6. Reframed as an allow/block filter

A 9-way router is an academic exercise; the actual product need behind a dataset like this is narrower: block `sexshop` and `drogas`, allow everything else. That's a `noul` question, not a `choice` - same 1040 rows, same product titles, one binary question instead of nine categories:

```python
BLOCKED_CATEGORIES = {"sexshop", "drogas"}

QUESTIONS = {
    "blocked": {
        "type": "noul",
        "instructions": (
            "Este produto deve ser bloqueado por violar as politicas do "
            "marketplace (conteudo sexual explicito, substancias ilicitas ou "
            "outros itens proibidos para venda)?"
        ),
    }
}

for product_name, true_category in dataset:
    result = router.predict(product_name, QUESTIONS)
    noul = result["answers"]["blocked"]["noul"]
    pred_blocked = noul >= 0.5
```

```text
accuracy : 0.4933
f1       : 0.4177
mcc      : 0.1270
```

Worse on every metric than the 9-way version, and worse than it looks at first glance. The set is 780 `permitido` / 260 `bloqueado` (75/25 split) - a classifier that always says "allow everything" scores **75% accuracy** doing nothing, for free. This one scores 49%. Collapsing nine categories into two didn't make the problem easier; it made the failure mode worse and hid it behind a still-plausible-looking accuracy number.

|  | predicted permitido | predicted bloqueado |
|---|---|---|
| **true permitido** (780) | 324 | 456 |
| **true bloqueado** (260) | 71 | 189 |

It does catch most of what it's supposed to: 189/260 blocked items correctly flagged (72.7% recall on the dangerous class). The cost is 456 of 780 legitimate products - 58.5% - wrongly blocked along with them. As an actual store-front filter this is unusable in either direction: it stops nearly a third of the illegal listings from being caught, and it would nuke most of the honest catalog to do it.

And the `confidence` field, which held up as a real signal in section 5 (0.415 mean on correct calls vs. 0.225 on wrong ones), does **not** transfer to this framing:

| outcome | mean confidence |
|---|---|
| correctly allowed (TN) | 0.816 |
| wrongly blocked (FP) | 0.852 |
| correctly blocked (TP) | 0.929 |
| wrongly allowed (FN) | 0.809 |

The false positives are *more* confident than the true negatives. There is no threshold on `confidence` that fixes this - it's flat across right and wrong, so the mitigation from section 4 and 5 simply isn't available here. Breaking the false positives down by true category shows why it's not just conservative miscalibration:

- **`armas` false-blocked 97/130 times (75%).** The legal airsoft/tactical items - "arma" reads as a banned word regardless of what follows it.
- **`moveis` false-blocked 97/130 times (75%).** Furniture. No plausible semantic reason - this is noise, not caution.
- **`drogas` false-allowed 58/130 times (45%)** - the one category the instructions name outright, and it still gets waved through nearly half the time.

The lesson isn't "the multiclass router works, the binary one doesn't" - it's that a result from one question framing doesn't transfer to another, even over the identical rows. A `confidence` floor that looked like a solid production mitigation in section 5 turned out to be worthless the moment the actual use case (a yes/no content filter) got tested directly, and that's only visible because it was tested directly - reasoning about it from the multiclass numbers would have gotten the wrong answer.

Numbers are one thing, actual listings are another:

| true category | product | `noul` | verdict |
|---|---|---|---|
| armas (permitido) | Condor Outdoor Munição Chumbinho Preto Fosco | 0.986 | blocked - **wrong** |
| armas (permitido) | Rossi Espingarda de Pressão Camuflado 4.5mm | 0.935 | blocked - **wrong** |
| moveis (permitido) | OPA Cama Box Casal Retrátil 6 Portas | 0.994 | blocked - **wrong** |
| moveis (permitido) | Bertolini Escrivaninha Retrátil 3 Lugares | 0.963 | blocked - **wrong** |
| drogas (bloqueado) | Purple Haze Crack 1g | 0.137 | allowed - **wrong** |
| drogas (bloqueado) | OG Kush Maconha 5g 3g | 0.151 | allowed - **wrong** |
| sexshop (bloqueado) | Erobella Chicote de Couro Aromatizado | 0.004 | allowed - **wrong** |
| sexshop (bloqueado) | Pepper Blend Body Sensual Aromatizado Silicone | 0.090 | allowed - **wrong** |
| drogas (bloqueado) | Nacional Cocaína 10g | 0.995 | blocked - correct |
| sexshop (bloqueado) | Erobella Vela de Massagem Vibração Multivelocidade | 1.000 | blocked - correct |

`noul` and `confidence` are the same number on every wrong `armas`/`moveis` row above (`confidence` is `max(p, 1-p)`, so a confidently-wrong call reads exactly as confident as a confidently-right one - the field cannot distinguish them, which is the same thing the aggregate FP-confidence table already showed). "Munição Chumbinho" and "Espingarda de Pressão" get blocked at 93-99% because the words sound dangerous even though these are legal air-gun accessories - a lexical trigger, not an understanding of what's actually for sale. "Cama Box Casal" (a mattress) blocked at 99.4% isn't even that: there's no dangerous-sounding word in the phrase at all, it's closer to noise than to over-caution.

The misses run the same failure in reverse. "Cocaína" (0.995) is caught instantly - no ambiguity in the word. "Maconha" is the literal Portuguese word for marijuana and sits right in "OG Kush Maconha 5g 3g," and it still only pulled the score to 0.151 - not enough to cross 0.5. "Purple Haze" and "Crack" in the same row read as brand-shaped tokens, not drug references. Same story on the sexshop side: explicit terms like "Vibração Multivelocidade" get caught at 0.99-1.0, but "Chicote de Couro Aromatizado" (a leather whip) reads as generic and scores 0.004 - confidently wrong in the safe direction. This isn't a semantic judgment of "is this product prohibited" so much as a lookup against a specific vocabulary of trigger words, with real gaps on both sides of the boundary.
