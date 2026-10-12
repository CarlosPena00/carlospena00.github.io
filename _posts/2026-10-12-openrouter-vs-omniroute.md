---
layout: post
title: "LLM Gateways: OpenRouter vs OmniRoute"
author: Carlos Pena
date: 2026-10-12
---

TL;DR: Use `OpenRouter` for the widest catalog and features like its auto router. Use `OmniRoute (Cheaper Inference)` when you already know which models you want and just want to pay less for them.

All of them give you one OpenAI-compatible endpoint in front of many LLM providers.

- [OpenRouter](https://openrouter.ai) - a hosted marketplace. You buy credits, it proxies to the providers at list price plus a fee.
- [OmniRoute](https://www.omniroute.online/) - comes in two flavors:
  - **Self-hosted** - [open source (MIT)](https://github.com/diegosouzapw/OmniRoute), runs on your machine and routes between your own accounts, free tiers and subscriptions.
  - **Hosted** - sold as **Cheaper Inference** ([platform.cheaperinference.com](https://platform.cheaperinference.com/)). One key, it routes each request to discounted sources and charges below list price.

The naming is confusing: same project, but the hosted one has its own brand, domain, keys (`ci_live_...`) and docs, and the two do not share all features. The code examples below use the hosted one.

## Quick comparison

| | OpenRouter | OmniRoute (self-hosted) | OmniRoute (Cheaper Inference) |
|---|---|---|---|
| Runs on | Their servers | Your machine (npm, Docker, desktop) | Their servers |
| Endpoint | `https://openrouter.ai/api/v1` | `http://localhost:20128/v1` | `https://api.cheaperinference.com/v1` |
| Billing | Prepaid credits, fee on top | Free; you pay each provider directly | Prepaid wallet (from $5) |
| Price | List price | Whatever your accounts cost; free tiers first | Below list, never above |
| Keys | One OpenRouter key | Your own key/login per provider | One `ci_live_` key |
| Fallback | Across providers, plus a `models` list you choose | Across your providers, models, subscriptions and free tiers | Automatic across sources of the same model |
| Routing knob | `provider.sort` (price, throughput, latency) | `auto/*` aliases and combos (19 strategies) | `ranking` (discount, speed, balance) |
| Privacy | `zdr`, `data_collection` | Gateway is local; data goes only to providers you connect | `zdr`, or ZDR for the whole account |
| Caching | Provider prompt caching | Provider prompt caching + semantic cache | Provider prompt caching + exact-response cache |
| Claude Code | No Anthropic endpoint | Supported | Yes (`/v1/messages`) |
| Extras | Auto router, web search | Token compression, MCP server, local dashboard | Token-saving techniques, A/B experiments, spend reports |
| Ops | None | You host, update and secure it | None |
| Best for | Widest model catalog | Squeezing free tiers and subscriptions you already have | Same models, smaller bill |

# OmniRoute

Change the `base_url` and the key. The rest is the standard OpenAI SDK:

```python
# uv add openai
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["CHEAPER_INFERENCE_API_KEY"],
    base_url="https://api.cheaperinference.com/v1",
)

response = client.chat.completions.create(
    model="aion-3.0-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

> Hello! How can I help you today? Whether you have a question, need assistance with something, or just want to chat, I'm here for you.

## What comes back

Printing the whole response object shows the extras. This one used `model="claude-sonnet-4.5"`:

```js
Out[3]: ChatCompletion(
    id="msg_011Cfy8mE8AdvzjjVqcKDc8Y",
    choices=[
        Choice(
            finish_reason="stop", index=0, logprobs=None,
            message=ChatCompletionMessage(
                content="Hello! How can I help you today?",
                refusal=None, role="assistant", annotations=None, audio=None, function_call=None, tool_calls=None,
                reasoning_content='The user is greeting me with "Hello!" This is a simple, friendly greeting. I should respond in a warm and welcoming manner.',
                reasoning_details=[
                    {
                        "type": "reasoning.text",
                        "format": "anthropic-claude-v1",
                        "index": 0,
                        "text": 'The user is greeting me with "Hello!" This is a simple, friendly greeting. I should respond in a warm and welcoming manner.',
                        "signature": "...",
                    }
                ],
            ),
        )
    ],
    created=1791844230,
    model="claude-sonnet-4.5",
    object="chat.completion",
    metadata=None, moderation=None, service_tier=None, system_fingerprint=None,
    usage=CompletionUsage(
        completion_tokens=48, prompt_tokens=38, total_tokens=86, completion_tokens_details=None,
        prompt_tokens_details=PromptTokensDetails(
            audio_tokens=None, cache_write_tokens=None, cached_tokens=0, image_tokens=None, text_tokens=None,
        ),
        cost=0.000542,
        cost_details={"upstream_inference_cost": 0.000542},
    ),
    cheaper_inference={
        "request_id": "6dc36a2c-92f0-42ff-b2a1-de64f7f67274",
        "billing": {
            "status": "settled",
            "billed_cost_usd": "0.000542",
            "currency": "USD",
            "zero_data_retention": False,
            "effective_discount_percent": 35.01199040767386,
        },
    },
)
```

- `usage.cost` - what you actually paid for this call, in USD.
- `cheaper_inference.billing.effective_discount_percent` - how far below list price it was (35% here).
- `cheaper_inference.request_id` - the ID to look the call up later or attach feedback to.
- `reasoning_content` - Claude's thinking summary, when the model thinks.

Failed requests are not charged; the wallet is debited only after a request completes.

## Routing parameters

Three non-OpenAI fields go in `extra_body`. The gateway reads them and strips them before forwarding:

```python
response = client.chat.completions.create(
    model="claude-sonnet-4.5",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=1024,
    extra_body={
        "ranking": "speed",            # "discount" | "speed" | "balance" (default)
        "min_discount_percent": 10,    # only sources at least 10% below list; Error code: 503 min_discount_unavailable
        "zdr": True,                   # zero data retention providers only
    },
)
```

There is no field to pick a fallback model. If a source fails before output starts,
the gateway retries the same model on the next source, and you are still never charged above list price.

## Caching

Two different caches.

**Prompt caching** (the provider's). OpenAI, DeepSeek and Gemini cache long prompts on their own. For Claude you mark what to cache with `cache_control`, or let the gateway add the markers with a header:

```python
response = client.chat.completions.create(
    model="claude-sonnet-4.5",
    messages=[
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": LONG_PRODUCT_CATALOG,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
        {"role": "user", "content": "Which items are ...?"},
    ],
    max_tokens=1024,
    extra_headers={
        "x-ci-prompt-cache": "on",               # on | off | passthrough (default); "on" may still be in preview
        "x-ci-prompt-cache-session": "chat-42",  # keep a conversation on the same source
    },
)
print(response.usage.prompt_tokens_details.cached_tokens)  # > 0 on a cache hit
```

Cache reads cost about 10% of the normal input price. The session header matters because a cache only lives on the provider that wrote it. ZDR turns prompt caching off.

**Exact-response cache** (the gateway's). An identical, deterministic request can be answered with a stored reply, without calling a provider. It is an optional technique (id `exact-cache`) and **off by default**, so every call is a `miss` until you enable it, in the dashboard under Techniques or through the API (key needs the `account:write` scope):

```python
import requests

BASE = "https://api.cheaperinference.com/v1"
HEADERS = {"Authorization": f"Bearer {os.environ['CHEAPER_INFERENCE_API_KEY']}"}

requests.get(f"{BASE}/techniques", headers=HEADERS).json()  # what exists, what is enabled
requests.patch(f"{BASE}/techniques/exact-cache", headers=HEADERS, json={"enabled": True})
```

Then send the same request twice, with `temperature=0`. The first call fills the cache, the second should be a hit:

```python
for _ in range(2):
    raw = client.chat.completions.with_raw_response.create(
        model="aion-3.0-mini",
        messages=[{"role": "user", "content": "Hello!"}],
        temperature=0, # Necessary
    )
    print(raw.headers.get("x-ci-cache"))      # "miss", then "hit"
    print(raw.headers.get("x-ci-saved-usd"))  # savings on this call
response = raw.parse()
# x-ci-cache miss
# x-ci-techniques
# x-ci-warning None
# x-ci-request-id 3767634b-8a1e-458b-a878-3505af790322

# x-ci-cache hit
# x-ci-techniques exact-cache
# x-ci-warning None
# x-ci-request-id 4ac902eb-49ac-4037-aed9-c65e742f5627
```


## Reasoning

Claude thinking through Chat Completions uses the portable `reasoning_effort` (`none` to `max`). Leave room in `max_tokens`, since thinking is billed as output:

```python
response = client.chat.completions.create(
    model="claude-sonnet-4.5",
    messages=[{"role": "user", "content": "Plan a 3-day trip to Recife."}],
    reasoning_effort="high",
    max_tokens=8192,
)
print(response.choices[0].message.reasoning_content)
```

## Account endpoints

Same key (with the right scope), same base URL:

```python
import requests

BASE = "https://api.cheaperinference.com/v1"
HEADERS = {"Authorization": f"Bearer {os.environ['CHEAPER_INFERENCE_API_KEY']}"}

requests.get(f"{BASE}/models", headers=HEADERS, params={"zdr": "true"}).json()  # catalog + prices
requests.get(f"{BASE}/account/balance", headers=HEADERS).json()                 # needs account:read
requests.get(f"{BASE}/usage/daily", headers=HEADERS).json()                     # spend, cache hit %
```

Keys can be restricted by model, IP range, rate, concurrency and monthly spend, which is handy for giving a key to a side project.

## Claude Code

There is also an Anthropic-compatible endpoint, so Claude Code can run through it. No `/v1` at the end, the client adds it:

```bash
export ANTHROPIC_BASE_URL="https://api.cheaperinference.com"
export ANTHROPIC_AUTH_TOKEN="$CHEAPER_INFERENCE_API_KEY"
claude
```


# OpenRouter

OpenRouter has its own Python SDK (the OpenAI SDK with `base_url="https://openrouter.ai/api/v1"` also works):

```python
# uv add openrouter
# export OPENROUTER_API_KEY="sk-or-v1-..."
import os
from openrouter import OpenRouter

with OpenRouter(api_key=os.getenv("OPENROUTER_API_KEY", "")) as client:
    response = client.chat.send(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": "Good morning!"}],
    )
    print(response.choices[0].message.content)
```

Model IDs are `provider/model`. A `:free` suffix marks a free variant (rate limited). To find the exact string for `model=`, list them:

```python
with OpenRouter(api_key=os.getenv("OPENROUTER_API_KEY", "")) as client:
    for model in client.models.list().data:
        if model.id.endswith(":free"):
            print(f"{model.name} -> {model.id}")
```

```js
Apodex: Apodex 1.1 Mini (free) -> apodex/apodex-1.1-mini:free // works
Dots Studio: Dots3-Note Preview (free) -> dots-studio/dots-3-note-preview:free
LiquidAI: LFM2.5-2.6B (free) -> liquid/lfm-2.5-2.6b:free
NVIDIA: Nemotron 3.5 Lightning (free) -> nvidia/nemotron-3.5-lightning:free
Thinking Machines: Inkling Small (free) -> thinkingmachines/inkling-small:free
Poolside: Laguna S 2.1 (free) -> poolside/laguna-s-2.1:free
Thinking Machines: Inkling (free) -> thinkingmachines/inkling:free
Poolside: Laguna XS 2.1 (free) -> poolside/laguna-xs-2.1:free
Cohere: North Mini Code (free) -> cohere/north-mini-code:free
NVIDIA: Nemotron 3.5 Content Safety (free) -> nvidia/nemotron-3.5-content-safety:free
NVIDIA: Nemotron 3 Ultra (free) -> nvidia/nemotron-3-ultra-550b-a55b:free
NVIDIA: Nemotron 3 Nano Omni (free) -> nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
Google: Gemma 4 26B A4B  (free) -> google/gemma-4-26b-a4b-it:free // 2026-10-12 TooManyRequestsResponseError
Google: Gemma 4 31B (free) -> google/gemma-4-31b-it:free
NVIDIA: Nemotron 3 Super (free) -> nvidia/nemotron-3-super-120b-a12b:free
```

## Jev Router: let Jev pick the model

[Jev](https://openrouter.ai/~typesafe) is TypeSafe's decision model: it does not write text, it answers typed questions (yes/no, score, choice) with probabilities. On OpenRouter you cannot call Jev itself, only `typesafe/jev-router`, where Jev makes one hidden decision per request:

1. Jev reads the prompt and picks the model and reasoning effort.
2. That model writes the answer.

```python
with OpenRouter(api_key=os.getenv("OPENROUTER_API_KEY", "")) as client:
    response = client.chat.send(
        model="typesafe/jev-router",
        messages=[{"role": "user", "content": "Good morning!"}],
    )
    print(response.model)  # which model Jev picked
    print(response.choices[0].message.content)
```

```js
openai/gpt-6-luna
Good morning! How can I help you today?
```

You pay the price of the model Jev picked (the router is listed at `-1`, meaning variable), so it is not free. Note it chose a strong model for a simple greeting; check the Activity page before routing lots of trivial traffic through it.

Jev's own answer only shows up indirectly, in `response.model`. To ask Jev your own questions and get the probabilities back, you need TypeSafe's API (`POST /v1/systemone`) or a gateway that passes it through, such as Vercel AI Gateway. Neither OpenRouter's chat endpoint nor Cheaper Inference offers that.
