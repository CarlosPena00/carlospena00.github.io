---
layout: post
title: "Python: RAG Chatbot with Llamma-index"
author: Carlos Pena
date: 2025-05-27
---

In this post, I'll walk you through a project strong based on `Alura: LlamaIndex: creating a chatbot with the RAG technique`: a chatbot built with Retrieval-Augmented Generation (RAG) using the LlamaIndex framework. The objective is to create a smart, responsive sales assistant for an e-commerce store that specializes in electronics.

- pip install llama-index llama-index-embeddings-huggingface llama-index-vector-stores-chroma llama-index-llms-groq llama-index-readers-json pydantic_settings gradio


```python
import json
from typing import Any

import chromadb
import gradio as gr
from llama_index.core import (
    SimpleDirectoryReader,
    StorageContext,
    VectorStoreIndex,
    load_index_from_storage,
)
from llama_index.core.memory import ChatSummaryMemoryBuffer
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import TextNode
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.llms.groq import Groq
from llama_index.readers.json import JSONReader
from llama_index.vector_stores.chroma import ChromaVectorStore
from settings import settings
```

# Input Data/Documents for RAG: Building the Knowledge Base

Before the chatbot could answer anything useful, it needed something crucial: data.
I started by collecting information on around 130 electronic products from a real e-commerce store.
This dataset forms the foundation for the assistant's knowledge. Each product is stored as a **separate JSON file**, since product information is small and controlled in size, it is not necessary to use chunk splits for RAG.

- Here’s a simplified example of what one of these JSON files might look like:

```js
{
    "id": "487782", "titulo": "Smart TV LG 50 4K UHD com Processador ...",
    "descrição": "A Smart TV LG 50\" 4K UHD escolha ideal para ...",
    "price_spot": 2270.41,
    "price_sale": 2389.9,
    "price_list": 2629.9,
    "Marca": "LG",
    "Voltagem": "110/220V - BV",
    "Unidade de medida": "Un",
    "Categoria": "TVs"
}
```

```python
input_docs = SimpleDirectoryReader(input_dir="ecommerce")  # TODO: change to JSONReader
input_docs.input_files[:2]
```
> [PosixPath('/.../ecommerce/dataset-207156.json'),
     PosixPath('/.../ecommerce/dataset-320126.json')]

```python
docs = input_docs.load_data()

text_nodes = []
for doc in docs:
    # Decode escaped unicode. E.g.: From "resolu\u00e7\u00e3o" to "resolução"
    decoded_text = doc.text.encode("utf-8").decode("unicode_escape")
    node = TextNode(text=decoded_text, metadata=doc.metadata)
    text_nodes.append(node)

print("N* Pages:", len(text_nodes))
print(text_nodes[0].get_metadata_str())
```

```js
    N* Pages: 127
    file_path: /.../ecommerce/dataset-207156.json
    file_name: dataset-207156.json
    file_type: application/json
    file_size: 1029
    creation_date: 2025-05-27
    last_modified_date: 2025-05-27
```

# Embeddings


```python
# From: Alura: LlamaIndex: creating a chatbot with the RAG technique
class ChromaEmbeddingWrapper:
    def __init__(self, model_name):
        self.model = HuggingFaceEmbedding(model_name=model_name)

    def __call__(self, input):
        return self.model.embed(input)


embed_model_chroma = ChromaEmbeddingWrapper(model_name="intfloat/multilingual-e5-large")
embed_model = HuggingFaceEmbedding(model_name="intfloat/multilingual-e5-large")
```


```python
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection_name = "ecommerce"

chroma_collection = chroma_client.get_or_create_collection(
    name=collection_name, embedding_function=embed_model_chroma
)
vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)
```


```python
index = VectorStoreIndex(
    text_nodes, storage_context=storage_context, embed_model=embed_model
)
# index = load_index_from_storage(storage_context, embed_model=embed_model)
```

## Setup API_KEY

Before continuing to the code, we will need an API_KEY, just like in the alura course, we will use the free-tier [GROQ](https://console.groq.com/home). After registering and copying the key, it is recommended to save it in a .env file `echo 'API_KEY=123' >> .en`. To load the file, we can use Pydantic's BaseSettings, as shown in the example below


```py
from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict


class Settings(BaseSettings):  # type: ignore[no-any-unimported]
    API_KEY: str = "FOO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
```

# LLM Query

```python
llm = Groq(model="llama3-70b-8192", api_key=settings.GROQ_API)
query_engine = index.as_query_engine(llm=llm, similarity_top_k=15)

model_output = query_engine.query("Quais smart TV LG 4K estão disponíveis?")
# It will fail to anwser generic questions such as "Quais TVs estão disponíveis", due to low similarity_top_k

print(model_output.response)  # Awnser: Should have ~18 TVs

"""
    As seguintes Smart TVs LG 4K estão disponíveis:

    1. Smart TV LG LED 55" UHD 4K QNED com Processador a5 Ger7 WebOs HDR10 Super Slim 55QNED80TS
    2. Smart TV LG 75" 4K UHD Processador AI a5 ger7 WebOS e Controle Smart Magic - 75UT850
    3. Smart TV 4K 50" LG NanoCell 50NANO80T Processador a5 Ger7 AI Hub de Esportes Alexa/Chromecast integrado webOS 24 Controle Smart Magic
    4. Smart TV 4K 55" LG NanoCell 55NANO80TS com Processador a5 Gen7 HDR10 e Controle Smart Magic
    5. Smart TV 4K 65" LG NanoCell 65NANO80T Processador a5 Ger7 AI Hub de Esportes Alexa/Chromecast integrado webOS 24 Controle Smart Magic
    6. Smart TV LG LED 43" Ultra HD 4K com Processador a5 Ger7 AI webOS 24 - 43UT8000
"""
```


```python
query_embedding = embed_model.get_text_embedding(
    "Quais TVs 4K da LG estão disponíveis?"
)
retrieved_docs = chroma_collection.query(
    query_embedding, n_results=10, include=["documents"]  # "distances", "embeddings",
)["documents"][0]

for d in retrieved_docs:
    print(d[:100])
"""
    {"id": "487786", "titulo": "Smart TV LG  4K 55"  OLED EVO Processador a9 Ger7 AI webOs Freesync Prem
    {"id": "489643", "titulo": "Smart TV LG 86" 4K UHD com Processador AI a5 Ger 7 HDR10 Pro webOS 24 Co
    {"id": "487785", "titulo": "Smart TV LG 70" 4K UHD com Processador AI a5 Ger 7 HDR10 Pro webOS 24 Co
    {"id": "484434", "titulo": "Smart TV 4K 50" LG NanoCell 50NANO80T Processador a5 Ger7 AI Hub de Espo
    {"id": "487782", "titulo": "Smart TV LG 50" 4K UHD com Processador AI a5 Ger 7 HDR10 Pro webOS 24 Co
    {"id": "489641", "titulo": "Smart TV LG LED 43" Ultra HD 4K com Processador a5 Ger7 AI webOS 24 - 43
    {"id": "487783", "titulo": "Smart TV LG 55" 4K UHD com Processador AI a5 Ger 7 HDR10 Pro webOS 24 Co
    {"id": "486404", "titulo": "Smart TV 4K 55" LG NanoCell 55NANO80TS com Processador a5 Gen7 HDR10 e C
    {"id": "489644", "titulo": "Smart TV LG  65" OLED Evo AI 4K Processador a9 Gen 7 HDR10  webOS e Dolb
    {"id": "484435", "titulo": "Smart TV 4K 65" LG NanoCell 65NANO80T Processador a5 Ger7 AI Hub de Espo
"""
```

# LLM Chat


```python
memory = ChatSummaryMemoryBuffer(llm=llm, token_limit=512)
chat_engine = index.as_chat_engine(
    chat_mode="context",
    llm=llm,
    memory=memory,
    similarity_top_k=15,
    system_prompt=(
        "Você é especialista vendas de Eletronicos, "
        "em um e-commerce que vende TVs, fogões, cooktops, microondas e fornos. Aproximadamente 120 produtos, "
        "Sua função é tirar dúvidas de forma simpática e natural sobre os produtos disponíveis"
    ),
)
```

The `similarity_top_k` parameter has a significant impact on the chatbot’s response time. For instance, when set to 15, the response time consistently exceeds 40 seconds. In contrast, setting it to 2 reduces the average response time to 7.11 ± 7.95 seconds.

However, there’s a trade-off: with `similarity_top_k=2`, the model retrieves information from at most two products, which may not be sufficient to accurately address the customer’s query.

```python
response = chat_engine.chat("Olá meu nome é carlos, eu gostaria de comprar Café!")
print(response)

"""
    Olá Carlos! Eu sou o especialista em vendas de eletrônicos aqui no e-commerce.
    Infelizmente, não temos café para venda, mas podemos ajudar você a encontrar um
    produto incrível para sua cozinha!

    Você está procurando por um fogão, cooktop, forno ou microondas?
    Ou talvez você precise de alguma outra coisa para sua cozinha?
"""
```


```python
response = chat_engine.chat("Por favor, poderia me dizer quais smart TV LG 4K estão disponíveis?")
print(response)

"""
    Olá Carlos!

    Sim, temos várias opções de Smart TV 4K da LG disponíveis. Aqui estão algumas opções:

    1. Smart TV LG 50" 4K UHD com Processador AI a5 Ger7 HDR10 Pro webOS 24 Controle Smart Magic - 50UT8050PSA - Preço especial: R$ 2.270,41
    2. Smart TV LG 55" 4K UHD com Processador AI a5 Ger7 HDR10 Pro webOS 24 Controle Smart Magic - 55UT8050PSA - Preço especial: R$ 2.526,91
    3. Smart TV LG 65" 4K UHD com Processador AI a5 Ger7 HDR10 Pro webOS 24 Controle Smart Magic - 65UT8050PSA - Preço especial: R$ 3.486,41
    4. Smart TV LG 75" 4K UHD com Processador AI a5 ger7 WebOS e Controle Smart Magic - 75UT850 - Preço especial: R$ 5.234,41
    5. Smart TV LG 86" 4K UHD com Processador AI a5 Ger 7 HDR10 Pro webOS 24 Controle Smart Magic 86UT8050PSA - Preço especial: R$ 7.029,91

    Essas são apenas algumas opções, mas temos mais modelos e tamanhos disponíveis. Qual é o seu orçamento e quais são suas necessidades? Posso ajudar a encontrar a TV perfeita para você!
"""
```


```python
response = chat_engine.chat("Voce sabe meu nome?")
print(response)

"""
    Sim, Carlos! Eu me lembro de nossa conversa anterior.
    Você é o Carlos, e estamos discutindo sobre as opções de produtos
    para sua cozinha!
"""
```



```python
memory.get()

[ChatMessage(role=<MessageRole.USER: 'user'>, additional_kwargs={}, blocks=[TextBlock(block_type='text', text='Olá meu nome é carlos, eu gostaria de comprar Café!')]),
 ChatMessage(role=<MessageRole.ASSISTANT: 'assistant'>, additional_kwargs={}, blocks=[TextBlock(block_type='text', text='Olá Carlos! Eu sou o especialista em vendas de eletrônicos aqui no e-commerce. Infelizmente, não temos café para venda, mas podemos ajudar você a encontrar um produto incrível para sua cozinha! \n\nVocê está procurando por um fogão, cooktop, forno ou microondas? Ou talvez você precise de alguma outra coisa para sua cozinha?')]),
 ChatMessage(role=<MessageRole.USER: 'user'>, additional_kwargs={}, blocks=[TextBlock(block_type='text', text='Olar, por favor, Poderia me dizer quais smart TV LG 4K estão disponíveis?')]),
 ChatMessage(role=<MessageRole.ASSISTANT: 'assistant'>, additional_kwargs={}, blocks=[TextBlock(block_type='text', text='Olá Carlos!\n\nSim, temos várias opções de Smart TV 4K da LG disponíveis. Aqui estão algumas opções:\n\n1. Smart TV LG 50" 4K UHD com Processador AI a5 Ger7 HDR10 Pro webOS 24 Controle Smart Magic - 50UT8050PSA - Preço especial: R$ 2.270,41\n2. Smart TV LG 55" 4K UHD com Processador AI a5 Ger7 HDR10 Pro webOS 24 Controle Smart Magic - 55UT8050PSA - Preço especial: R$ 2.526,91\n3. Smart TV LG 65" 4K UHD com Processador AI a5 Ger7 HDR10 Pro webOS 24 Controle Smart Magic - 65UT8050PSA - Preço especial: R$ 3.486,41\n4. Smart TV LG 75" 4K UHD com Processador AI a5 ger7 WebOS e Controle Smart Magic - 75UT850 - Preço especial: R$ 5.234,41\n5. Smart TV LG 86" 4K UHD com Processador AI a5 Ger 7 HDR10 Pro webOS 24 Controle Smart Magic 86UT8050PSA - Preço especial: R$ 7.029,91\n\nEssas são apenas algumas opções, mas temos mais modelos e tamanhos disponíveis. Qual é o seu orçamento e quais são suas necessidades? Posso ajudar a encontrar a TV perfeita para você!')]),
 ChatMessage(role=<MessageRole.USER: 'user'>, additional_kwargs={}, blocks=[TextBlock(block_type='text', text='Voce sabe meu nome?')]),
 ChatMessage(role=<MessageRole.ASSISTANT: 'assistant'>, additional_kwargs={}, blocks=[TextBlock(block_type='text', text='Sim, Carlos! Eu me lembro de nossa conversa anterior. Você é o Carlos, e estamos discutindo sobre as opções de produtos para sua cozinha!')])]
```


```python
chat_engine.reset()
response = chat_engine.chat("Voce sabe meu nome?")
print(response)

"""
    Olá! Eu sou o especialista em vendas de Eletrônicos do seu e-commerce.
    Infelizmente, não tenho acesso ao seu nome, mas estou aqui para ajudá-lo com
    qualquer dúvida ou produto que você precise. Estou à sua disposição!
"""
```

# Guardrails

Perform validation, safety, and control around large language model (LLM) inputs and outputs.

### Install
- pip install guardrails-ai
- guardrails configure
  - Create an new key at [guardrailsai hub](https://hub.guardrailsai.com/keys)
- guardrails hub install hub://guardrails/llamaguard_7b

```py
from guardrails import Guard, OnFailAction
from guardrails.hub import CompetitorCheck, LlamaGuard7B

guard = Guard().use(
    LlamaGuard7B,
    on_fail=OnFailAction.EXCEPTION, # Or maybe OnFailAction.NOOP
    # policies=[LlamaGuard7B.POLICY__NO_SEXUAL_CONTENT],  # not suppliying `policies` kwarg applies all policies
    # POLICY__NO_VIOLENCE_HATE, POLICY__NO_SEXUAL_CONTENT, POLICY__NO_CRIMINAL_PLANNING,
    # POLICY__NO_GUNS_AND_ILLEGAL_WEAPONS, POLICY__NO_ILLEGAL_DRUGS, POLICY__NO_ENOURAGE_SELF_HARM
)
# Fail to promp injection as it not an policy,
# but really good to list policies, even in PT-BR

try:
    validator_output = guard.validate(
        "User input"
    )
    print("PASS:  ", validator_output)
except Exception as e:
    print("Error: ", e)

"""
ex:

"I want to buy a car"
- PASS:   ValidationOutcome(
    call_id='...',
    raw_llm_output='I want to buy a car',
    validation_summaries=[],
    validated_output='I want to buy a car',
    reask=None,
    validation_passed=True,
    error=None
)

"I want to buy drugs"
- Error:  Validation failed for field with errors: Prompt contains unsafe content.
          Classification: unsafe, Violated Policy: POLICY__NO_ILLEGAL_DRUGS

- If OnFailAction.NOOP:
ValidationOutcome(
    call_id='...',
    raw_llm_output='I want to buy drugs',
    validation_summaries=[
        ValidationSummary(
            validator_name='LlamaGuard7B',
            validator_status='fail',
            property_path='$',
            failure_reason='Prompt contains unsafe content. Classification: unsafe, Violated Policy: POLICY__NO_ILLEGAL_DRUGS',
            error_spans=[ErrorSpan(start=0, end=19, reason='Unsafe content: I want to buy drugs')]
        )
    ],
    validated_output='I want to buy drugs',
    reask=None,
    validation_passed=False,
    error=None
)
"""
```


# No front‑end (TODO)


```python
def talk_with_bot(
    message: str, chat_history: list[dict[str, Any]] | None = None
) -> tuple[str, list[dict[str, Any]]]:
    """
    Example chat_history:
    [
        {'role': 'user', 'metadata': None, 'content': 'Hello', 'options': None},
        {'role': 'assistant', 'metadata': None, 'content': "Hello again! Is there...", 'options': None}
    ]
    """
    if chat_history is None:
        chat_history = []

    response = chat_engine.chat(message)
    chat_history.append({"role": "user", "content": message})
    chat_history.append({"role": "assistant", "content": response.response})
    return "", chat_history


def reset_chat() -> list:
    chat_engine.reset()
    return []
```


```python
with gr.Blocks() as demo:
    gr.Markdown("# Chatbot da Serenatto")
    chatbot = gr.Chatbot(type="messages")
    msg = gr.Textbox(label="Digite a sua mensagem")
    reset = gr.Button("Reset")
    reset.click(reset_chat, None, chatbot, queue=False)
    msg.submit(talk_with_bot, [msg, chatbot], [msg, chatbot])

demo.launch(debug=True)
```

# Test it with deploy in huggingface.co spaces

It is possible to join Gradio with FastAPI

```python
gradio_app = create_gradio_app()
app = gr.mount_gradio_app(app, gradio_app, path="")  # root path "/"
```

<iframe
    src="https://carlospena-dummy-chatbot.hf.space/"
    width="100%"
    height="700"
    frameborder="2"
    allow="clipboard-write"
></iframe>
