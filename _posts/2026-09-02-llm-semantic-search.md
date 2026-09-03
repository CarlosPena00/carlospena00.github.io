---
layout: post
title: "LLM: Large Language Models with Semantic Search"
author: Carlos Pena
date: 2026-09-02
---

My notes from the DeepLearning.AI short course [Large Language Models with Semantic Search](https://learn.deeplearning.ai/courses/large-language-models-semantic-search/lesson/lndoo/keyword-search) (Cohere + Weaviate).


```bash
uv add cohere weaviate-client annoy numpy pandas scikit-learn
```

```python
import os

import cohere
import numpy as np

co = cohere.Client(os.environ["COHERE_API_KEY"])
```

---

## 1. Keyword search

The standard scoring function is **BM25**, which ranks a document higher when the query terms appear often in it (term frequency), are rare across the corpus (inverse document frequency), and the document is not artificially long (length normalization).

The index behind it is an **inverted index**: term -> list of documents containing it. That is why keyword search is so fast and why it is still the default in Elasticsearch, Lucene, Postgres full-text and Weaviate's `bm25` operator.

```python
import weaviate
from weaviate.classes.init import Auth

client = weaviate.connect_to_weaviate_cloud(
    cluster_url=os.environ["WEAVIATE_URL"],
    auth_credentials=Auth.api_key(os.environ["WEAVIATE_API_KEY"]),
)

articles = client.collections.get("Article")

response = articles.query.bm25(
    query="what is the capital of canada",
    limit=3,
    return_properties=["title", "text", "url"],
)

for obj in response.objects:
    print(obj.properties["title"])
```

The failure mode is **vocabulary mismatch**. A document that says *"Ottawa is the seat of the federal government"* never uses the word "capital", so BM25 scores it near zero. No amount of tuning fixes that, because the problem is lexical, not statistical.

Where keyword search still wins: exact identifiers (SKU, error codes, `KeyError`), rare proper nouns, and any query where the user typed the literal string they expect back. Do not throw it away.

---

## 2. Embeddings

An embedding maps a piece of text to a vector, positioned so that texts with similar meaning end up close together. "Capital of Canada" and "seat of the Canadian government" land in the same neighborhood even with zero shared tokens.

```python
texts = [
    "Ottawa is the capital of Canada",
    "The seat of the Canadian federal government",
    "Best pizza recipes for a home oven",
]

response = co.embed(
    texts=texts,
    model="embed-english-v3.0",
    input_type="search_document",
)

embeddings = np.array(response.embeddings)
print(embeddings.shape)  # (3, 1024)
```

Similarity is cosine similarity - the dot product of L2-normalized vectors:

```python
def cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a = a / np.linalg.norm(a, axis=-1, keepdims=True)
    b = b / np.linalg.norm(b, axis=-1, keepdims=True)
    return a @ b.T


print(cosine_similarity(embeddings[0], embeddings[1]))  # ~0.72
print(cosine_similarity(embeddings[0], embeddings[2]))  # ~0.09
```

To see the space, the course projects the 1024 dimensions down to 2 with UMAP and plots it:

```python
from utils import umap_plot

chart = umap_plot(texts, embeddings)
chart.interactive()
```

`umap_plot` is a course helper - it runs `umap.UMAP()` over the embedding matrix and returns an interactive Altair scatter, so hovering a point shows the sentence behind it. Semantically related sentences land on top of each other and unrelated ones sit in far corners of the plot, which is the whole claim of the lesson made visible.

Two details that cost me time:

- **`input_type` matters.** Cohere v3 models are asymmetric: index your corpus with `search_document` and embed the user query with `search_query`. Using the same type for both measurably degrades ranking.
- **The 2D plot is a sanity check, not the truth.** UMAP distorts distances to fit the projection, so rank by cosine similarity in the original space and use the picture only to spot problems. If a whole corpus collapses into one blob, the chunking is wrong, not the model.

---

## 3. Dense retrieval

Dense retrieval = embed the corpus, embed the query, return the nearest neighbors. Brute force is fine up to a few hundred thousand vectors; past that you need an approximate nearest neighbor (ANN) index. The course uses Annoy, which builds a forest of random projection trees.

```python
from annoy import AnnoyIndex

DIM = 1024

index = AnnoyIndex(DIM, "angular")  # angular == cosine
for i, vector in enumerate(embeddings):
    index.add_item(i, vector)

index.build(n_trees=10)
index.save("corpus.ann")


def dense_search(query: str, k: int = 5) -> list[tuple[str, float]]:
    query_vector = co.embed(
        texts=[query],
        model="embed-english-v3.0",
        input_type="search_query",
    ).embeddings[0]

    ids, distances = index.get_nns_by_vector(
        query_vector, k, include_distances=True
    )
    return [(texts[i], 1 - (d**2) / 2) for i, d in zip(ids, distances)]


for text, score in dense_search("who governs canada"):
    print(f"{score:.3f}  {text[:60]}")
```

**Chunking is the decision that actually moves the metric.** An embedding of a 5000 word article is an average of everything it says, so it is close to nothing in particular. Options, roughly in increasing quality:

| Strategy | Notes |
|---|---|
| Whole document | Cheap, only works for short documents |
| Fixed window (e.g. 512 tokens) | Simple, cuts sentences in half |
| Sentence or paragraph | Good default, keeps semantic units |
| Window with overlap (10-20%) | Avoids losing context at boundaries |
| Chunk + document title prefix | Cheap trick, usually a real gain |

Dense retrieval is not a free upgrade. It fails on out-of-domain vocabulary the embedding model never saw, on exact-match queries (order `#48213` embeds like every other order number), and it always returns something - there is no natural "no result" threshold.

---

## 4. Hybrid search

Since keyword and dense fail in opposite situations, run both and merge. Weaviate exposes this with an `alpha` weight, where `0.0` is pure BM25 and `1.0` is pure vector.

```python
response = articles.query.hybrid(
    query="what is the capital of canada",
    alpha=0.5,
    limit=10,
    return_properties=["title", "text"],
)
```

If you merge the two ranked lists yourself, **Reciprocal Rank Fusion (RRF)** is the usual choice. It was not built for this - the original 2009 paper (Cormack et al.) fused rankings from different retrieval systems in TREC - but it turns out to be exactly what hybrid search needs: BM25 scores and cosine distances live on incomparable scales, and RRF never looks at the scores, only at each document's *position* in each list.

```
score(doc) = sum over each ranking r that contains doc of  1 / (k + rank_r(doc))
```

Rank starts at 1 (the top result). `k` is a smoothing constant, `60` in the original paper and almost everywhere since - raise it to flatten the curve so rank differences matter less (good when one retriever is noisy), lower it to make the top few ranks dominate.

```python
def reciprocal_rank_fusion(
    rankings: list[list[str]], k: int = 60
) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1 / (k + rank)
    return sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
```

Worked example. BM25 nails the exact phrase but misses the paraphrase; dense retrieval does the opposite:

```python
bm25_ids = ["doc_ottawa", "doc_toronto", "doc_montreal"]
dense_ids = ["doc_seat_of_gov", "doc_ottawa", "doc_parliament"]

fused = reciprocal_rank_fusion([bm25_ids, dense_ids])
```

| doc_id | BM25 rank | Dense rank | RRF score |
|---|---|---|---|
| `doc_ottawa` | 1 | 2 | 1/61 + 1/62 = 0.0325 |
| `doc_seat_of_gov` | - | 1 | 1/61 = 0.0164 |
| `doc_toronto` | 2 | - | 1/62 = 0.0161 |
| `doc_parliament` | - | 3 | 1/63 = 0.0159 |
| `doc_montreal` | 3 | - | 1/63 = 0.0159 |

`doc_ottawa` wins even though it was never rank 1 anywhere, because it is the only document both retrievers agree on - that's the property RRF is actually chosen for: it rewards consensus, not just a single system's top pick. A document missing from a ranking simply contributes nothing from that term, no imputed rank and no penalty term to tune.

This scales past two lists for free - fuse BM25, dense, and a third signal (recency, a business-rules re-score) the same way, just pass more rankings in.

Where it loses to Weaviate's `alpha`: RRF treats every ranking as equally trustworthy. If you know dense retrieval is the stronger signal for your corpus, a weighted score (`alpha=0.7` toward vector) can outperform it; RRF has no lever for "trust list B more," short of running it through twice.

---

## 5. ReRank

The retriever optimizes for recall over millions of documents, so it is a **bi-encoder**: query and document are embedded independently and only ever meet in a dot product. That is what makes it precomputable and fast, and also what makes it imprecise.

A reranker is a **cross-encoder**: it feeds `(query, document)` through the model together, so every query token can attend to every document token. Far more accurate, far too slow to run over the corpus. So the pipeline is: retrieve 100 cheaply, rerank those 100, keep the top 3.

```python
candidates = dense_search("who governs canada", k=100)

reranked = co.rerank(
    query="who governs canada",
    documents=[text for text, _ in candidates],
    top_n=3,
    model="rerank-english-v3.0",
    return_documents=True,
)

for result in reranked.results:
    print(f"{result.relevance_score:.3f}  {result.document.text[:60]}")
```

### What the cross-encoder actually computes

`co.rerank` is a hosted endpoint, so the mechanics are invisible. Running the open equivalent locally shows what the API is doing. The input is not two texts, it is one sequence:

```text
<s> who governs canada </s></s> The seat of the Canadian federal government </s>
```

(`bge-reranker-v2-m3` is XLM-RoBERTa, so the pair is wrapped with `<s>` / `</s>`; a BERT-family reranker would use `[CLS]` / `[SEP]` instead.)

Both segments go through the same forward pass, so self-attention crosses the separator: the token `governs` can attend to `federal government`. That is the entire difference from section 2 - a bi-encoder never lets a query token see a document token, because the document was embedded months earlier and its vector is frozen in the index.

The model is loaded as a sequence classifier with a single label, which is literally what a reranker is:

```python
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

tok = AutoTokenizer.from_pretrained("BAAI/bge-reranker-v2-m3")
model = AutoModelForSequenceClassification.from_pretrained("BAAI/bge-reranker-v2-m3")
model.eval()

query = "who governs canada"
docs = [
    "The seat of the Canadian federal government",
    "The Parliament of Canada sits in Ottawa",
    "Ottawa is the capital of Canada",
    "Best pizza recipes for a home oven",
]

inputs = tok(
    [[query, d] for d in docs],
    padding=True,
    truncation=True,
    max_length=512,
    return_tensors="pt",
)

with torch.no_grad():
    logits = model(**inputs).logits.view(-1)
    scores = torch.sigmoid(logits)
```

| Document | Logit | Sigmoid |
|---|---|---|
| The seat of the Canadian federal government | +3.10 | 0.957 |
| The Parliament of Canada sits in Ottawa | +2.40 | 0.917 |
| Ottawa is the capital of Canada | +1.60 | 0.832 |
| Best pizza recipes for a home oven | -6.20 | 0.002 |

Numbers are illustrative, but the shape is the point: the reranker puts the paraphrase above the literal match, because it reads `governs` as the operative word. BM25 in section 1 does the exact opposite.

### There is no distance inside a cross-encoder

In section 2, "close" is literal: two points, one cosine, a space that exists independently of any query. A cross-encoder has no such space. It does not produce a query vector and a document vector, it produces one vector - the final hidden state of `[CLS]` - and that vector represents the *pair*. There is nothing to measure a distance between.

The geometry does not disappear, it changes shape. The classification head learns a vector `w`, the direction that means "relevant" in pair space, and `w · h + b = 0` is a decision hyperplane. The logit is the signed distance from the pair representation to that plane:

```text
  irrelevant  |  relevant
              |
  -6.20 ------+------ +1.60  +2.40  +3.10
  pizza       0       ottawa  parl   seat
              |
       w · h + b = 0
```

So "far" means far from the plane, and the sign says which side. The pizza document is not far from the Ottawa documents, it is on the other side of the boundary. That is also why the rerank barely reordered the three Canada documents while collapsing the fourth: the value of this stage is separation, not permutation.

The consequence is that the score is not a metric:

- Not symmetric. `score(query, doc) != score(doc, query)`, because the model is trained with the query in the first segment.
- No triangle inequality. "A is relevant to Q, B resembles A, therefore B is relevant to Q" does not hold.
- `score(d, d)` is not the maximum, unlike `cos(d, d) == 1`.

Which is why you cannot put a reranker behind an ANN index. HNSW and IVF need a metric with structure, where neighbors of neighbors are neighbors. Brute force over the shortlist is the only option, nothing is precomputable because `h` depends on the query, and cost is linear in `k`. That is the real reason the pipeline has two stages, and the reason `k` is 100 and not 10,000.

### The classification head

Everything above the transformer body is small. The body - XLM-RoBERTa large in this model, 24 layers, roughly 568M parameters - produces `h_CLS`, 1024 numbers summarizing the pair. The head turns that into the one number you threshold:

```python
print(model.classifier)
print(model.classifier.out_proj.weight.shape)  # torch.Size([1, 1024])  <- w
print(model.classifier.out_proj.bias.shape)    # torch.Size([1])        <- b
```

In the RoBERTa family the head is `dense(1024 -> 1024) -> tanh -> out_proj(1024 -> 1)`: about 1.05M parameters, 0.19% of the model, and the final layer that actually emits the logit has 1025. In the BERT family it is a single `nn.Linear(hidden, 1)`, so the hyperplane separates `h_CLS` directly; in RoBERTa it separates `tanh(dense(h_CLS))`.

There is no magic between the vector and the score - it is two matrix multiplications, and you can recompute them by hand:

```python
inputs = tok([[query, "Best pizza recipes for a home oven"]], return_tensors="pt")

with torch.no_grad():
    cls = model.roberta(**inputs).last_hidden_state[:, 0, :]  # [1, 1024]
    manual = model.classifier.out_proj(torch.tanh(model.classifier.dense(cls)))
    official = model(**inputs).logits

print(manual, official)  # same value
```

The head is also what defines the task. Same body, different head:

| Head | Output | Task |
|---|---|---|
| `Linear(1024, 1)` | one logit | reranking |
| `Linear(1024, 2)` + softmax | two probabilities | binary classification |
| `Linear(1024, N)` + softmax | N probabilities | multiclass classification |
| none | the vector itself | the bi-encoder from section 3 |

The last row is the useful one: a bi-encoder is this architecture with the head removed and the vector exposed, which is why the two models look identical on paper and behave nothing alike. The head is also the part initialized randomly at fine-tuning time - `w` starts pointing nowhere, and training on `(query, document, label)` triples rotates it onto the relevance direction.

### Thresholding

A reranker reorders, it does not remove. `top_n=3` hides that: the pizza document is still in the candidate set, it just fell to position 4. With 100 candidates and a fixed `top_n`, an irrelevant document gets returned whenever fewer than `top_n` relevant ones exist.

```python
reranked = co.rerank(
    query=question,
    documents=[text for text, _ in candidates],
    top_n=10,
    model="rerank-english-v3.0",
)
kept = [r for r in reranked.results if r.relevance_score >= 0.30]
```

Pick that constant from data, not by feel. Cohere normalizes `relevance_score` into 0-1, but the distribution still shifts with query difficulty: a specific query gives one tall isolated peak, a vague one gives a flat band where nothing clears 0.4. Two defenses, in increasing order of effort:

- a relative floor, `score >= max(0.30, top_score * 0.4)`, which survives that shift;
- a threshold read off the precision/recall curve on the labeled set from section 7, chosen by what a false positive costs you against a false negative.

One bound worth knowing before you spend money on a bigger reranker: it can only read what is in the chunk. `"Ottawa"` gives the attention two tokens to work with. `"Ottawa | Category: Canadian capitals | Federal government seat"` gives `governs` something to attach to. Enriching documents usually beats upgrading the model, and it costs nothing at inference time - the same conclusion the chunking table in section 3 arrives at from the other direction.

This is the single highest leverage stage in the pipeline. Adding a reranker on top of an average retriever usually beats spending the same effort tuning the retriever - and unlike a raw cosine score, the output is close enough to calibrated relevance that a threshold on it can legitimately return nothing.

---

## 6. Generating answers

With good retrieval in place, generation is the easy part: stuff the reranked chunks into the prompt and demand the model stay inside them.

```python
PROMPT = """Answer the question using only the context below.
If the context does not contain the answer, say "I don't know".
Cite the source number for each claim.

Context:
{context}

Question: {question}
Answer:"""


def answer(question: str) -> str:
    candidates = dense_search(question, k=100)
    reranked = co.rerank(
        query=question,
        documents=[text for text, _ in candidates],
        top_n=3,
        model="rerank-english-v3.0",
        return_documents=True,
    )
    context = "\n\n".join(
        f"[{i}] {r.document.text}" for i, r in enumerate(reranked.results, 1)
    )

    response = co.chat(
        message=PROMPT.format(context=context, question=question),
        model="command-r-plus",
        temperature=0,
    )
    return response.text


print(answer("who governs canada"))
```

Two things the course is explicit about, and they match what I have seen in practice:

- **Most RAG failures are retrieval failures.** If the answer is not in the context, no prompt engineering recovers it. Debug the retriever before the prompt.
- **Long context does not replace retrieval.** A model with a million token window still degrades when the relevant fact is buried in the middle, and you pay for every token you paste.

---

## 7. Evaluating search

Without this the rest is guesswork. You need a labeled set of `(query, relevant document ids)` - a few hundred pairs is enough to detect real regressions, and you can bootstrap them by asking an LLM to generate a plausible question for each chunk.

```python
def recall_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    if not relevant:
        return 0.0
    hits = len(set(retrieved[:k]) & relevant)
    return hits / len(relevant)


def mean_reciprocal_rank(
    retrieved_per_query: list[list[str]], relevant_per_query: list[set[str]]
) -> float:
    total = 0.0
    for retrieved, relevant in zip(retrieved_per_query, relevant_per_query):
        for rank, doc_id in enumerate(retrieved, start=1):
            if doc_id in relevant:
                total += 1 / rank
                break
    return total / len(retrieved_per_query)


def ndcg_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    dcg = sum(
        1 / np.log2(rank + 1)
        for rank, doc_id in enumerate(retrieved[:k], start=1)
        if doc_id in relevant
    )
    ideal = sum(
        1 / np.log2(rank + 1)
        for rank in range(1, min(len(relevant), k) + 1)
    )
    return dcg / ideal if ideal else 0.0
```

Which metric for which stage:

| Metric | Question it answers | Use it on |
|---|---|---|
| Recall@k | Did the candidate set contain the answer at all? | Retriever (k = 50-100) |
| MRR | How high is the first correct result? | Reranker, single-answer queries |
| nDCG@k | Is the whole ordering good, weighted by position? | Reranker, multi-answer queries |
| Precision@k | How much of what I showed is relevant? | Final user-facing list |

Measure the retriever with recall at a large k - its only job is to not lose the answer. Measure the reranker with MRR or nDCG at a small k - its only job is to put the answer first.

---

## Takeaways

- Build the pipeline in stages and measure each one; a single end-to-end score tells you nothing about where the loss happens.
- Keyword search is not obsolete. Hybrid beats either side alone on real query mixes.
- Chunking and `input_type` are boring and they dominate the results.
- The reranker is the best quality per unit of effort in the whole stack.
- RAG quality is retrieval quality. Fix the retriever first.
