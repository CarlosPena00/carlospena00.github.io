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

| options | input tokens | mean | std |
|---|---|---|---|
| 2 | 43 | 254.4 ms | 19.40 ms |
| 4 | 61 | 288.4 ms | 3.55 ms |
| 8 | 97 | 361.7 ms | 6.62 ms |
| 16 | 169 | 517.8 ms | 7.82 ms |
| 32 | 185 | 558.9 ms | 23.60 ms |
| 64 | 277 | 774.9 ms | 7.43 ms |

(Run with the background load from above already closed - a couple of entries still show a wider std dev than the others. Even a "clean" desktop benchmark isn't a lab bench.)

Latency tracks input tokens, not option count directly - the whole `criteria` dict goes into one forward pass, there's no per-option encoding step. 16 -> 32 options barely adds tokens (169 -> 185, since `"describes item number N"` reuses most of its subwords) and latency barely moves (517.8ms -> 558.9ms); 32 -> 64 nearly doubles the token count (185 -> 277) and latency jumps with it (558.9ms -> 774.9ms). The real lever on cost is criteria text length, not the number of buckets - ten verbose options can cost more than fifty terse ones.

One of these runs also printed a `RuntimeWarning` straight from the library:

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

| questions | input tokens | mean | std | ms/question |
|---|---|---|---|---|
| 1 | 58 | 269.8 ms | 6.29 ms | 269.8 ms |
| 2 | 116 | 385.7 ms | 4.99 ms | 192.8 ms |
| 4 | 232 | 651.8 ms | 13.52 ms | 162.9 ms |
| 8 | 464 | 1212.0 ms | 11.10 ms | 151.5 ms |
| 16 | 928 | 2593.4 ms | 26.27 ms | 162.1 ms |

There is a real batching win on CPU too, just a much smaller one: per-question cost drops from 269.8ms solo to ~151-163ms once 4 or more share a call, roughly 40% - nowhere near the README's ~5x GPU figure, and it plateaus by 4 questions instead of continuing to improve out to 16. The 16-question row is also the one to distrust the most: `input_tokens` hit 928, comfortably past the 512-token limit the README states for this checkpoint, with no error and no warning printed. There's no way to tell from the outside whether it silently truncated the tail questions or scored the full sequence anyway - either way, that row is exactly the kind of result the "token-budget tuning" warning is about, and it's worth re-verifying against ground truth before trusting it, not just timing it.

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
    "model": "laya-rl-agent",
    "answers": {
        "intent": {
            "type": "choice",
            "choice": "unrelated",
            "probabilities": {
                "single_product": 0.3129,
                "multi_product": 0.215,
                "product_question": 0.123,
                "unrelated": 0.3491,
            },
            "confidence": 0.0484,
            "answer_confidence": 0.3491,
            "action": {"act_probability": 1.0},
        },
        "needs_human": {
            "type": "noul",
            "noul": 0.0466,
            "confidence": 0.9534,
            "answer_confidence": 0.9534,
            "action": {"act_probability": 1.0},
        },
    },
    "usage": {"input_tokens": 198, "output_tokens": 0},
    "routing": {
        "model": "english",
        "repo": "convaiinnovations/laya",
        "reason": "English Latin text",
        "detection": {
            "script": "latin",
            "script_profile": {"latin": 1.0},
            "language": "en",
            "is_english": True,
            "language_undecided": False,
            "diacritic_rate": 0.0,
            "non_latin_fraction": 0.0,
        },
        "workflow": None,
    },
}
```

Reading through it:

- **`answers.intent.probabilities`** is the full distribution, not just the winner. `unrelated` (0.3491) barely beats `single_product` (0.3129) - all four options are within 0.23 of each other. This was never a confident call; taking `argmax` and stopping there, as `classify_intent` does, throws away exactly the information that would have flagged it.
- **`confidence` vs `answer_confidence`.** `answer_confidence` is just the chosen option's own probability (0.3491). `confidence` (0.0484) is a separate, lower number - it collapses when the top options are bunched together, which is what happened here. For `needs_human`, both read high (0.9534) because 0.0466 is decisively close to 0 - the model is confident, and in that instance it happens to be right. The lesson: threshold on `confidence`, not on whichever option won, before you route on `choice` output.
- **`model` (top level) vs `routing.model`.** The outer `'laya-rl-agent'` names the decision-engine wrapper, not the checkpoint that scored the text - that's `routing.model: 'english'`. `routing` also logs *why* it picked that checkpoint (`reason`, `detection.script`, `detection.language`) - useful to log in production so a misrouted non-English message doesn't fail silently.
- **`usage.output_tokens: 0`.** This is the concrete evidence for the "no generation" claim in section 1 - `input_tokens` is nonzero (the encoder still tokenizes the prompt), but nothing is decoded.
- **`action.act_probability: 1.0`** on every answer here is a hook from Laya's RL-agent framework for skipping a question outright (e.g., "don't answer, ask a follow-up instead"); at `1.0` it always acted in this run, but it's a lever this project exposes that a plain classifier wouldn't.

Practical takeaway: don't build on `classify_intent`'s two-field return in production. Pull `confidence` alongside `choice`, and fall back to the LLM (or a "not sure" branch) whenever it drops below some threshold you tune on your own data - the raw output already tells you which answers not to trust, `classify_intent` was just throwing that signal away.
