---
layout: post
title: "LLM: AWS Bedrock AgentCore"
author: Carlos Pena
date: 2026-10-09
---

Writing an agent loop that works on your laptop takes an afternoon. Running it for real users is the hard part: session isolation, memory that outlives one conversation, tools that need OAuth tokens for *that* user, traces you can debug, limits so one prompt can't run up a bill. [Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html) is AWS's answer to that second part. It is a set of separate managed services, each covering one piece of what an agent needs in production. You can use one of them or all of them.

These notes come from an AWS workshop on building agents with Strands and AgentCore, plus the docs I read afterwards to fill in the gaps.

---

## 1. Anatomy of an agent

```text
  system prompt + persona                         the agent's "brain"
  + user prompt / query   <------+     +------->  (LLM)
                                 |     |
                                 v     v
                             +-------------+
                             |    Agent    |
                             +-------------+
                              ^     ^     ^
                              |     |     |
                              v     v     v
          plan, reason      interact with the      store past interactions
          and orchestrate   outside world          in short- and long-term
                            through tools          memory
```

Every agent framework (Strands, LangGraph, CrewAI, a hand-rolled `while` loop) has the same pieces:

| Piece | What it does | AgentCore service |
|---|---|---|
| System prompt + persona + user query | The input and the instructions | Your config / your code |
| The "brain" (LLM) | Decides the next step | Any model: Bedrock, OpenAI, Gemini, LiteLLM |
| Plan, reason, orchestrate | The loop itself: think, call a tool, read the result, repeat | **Runtime** (your loop) or **Harness** (managed loop) |
| Interact with the outside world through tools | APIs, code execution, a browser | **Gateway**, **Code Interpreter**, **Browser** |
| Store past interactions in short- and long-term memory | Context within a session and across sessions | **Memory** |

AgentCore adds the pieces the diagram leaves out, which are mostly about running agents for other people:

| Service | Why you need it |
|---|---|
| **Identity** | Who is calling the agent (inbound JWT), and which credentials the agent uses to call other systems on that user's behalf (outbound OAuth / API key vault) |
| **Policy** | Rules about what the agent may do, written in natural language or Cedar, enforced on Gateway tool calls |
| **Observability** | OpenTelemetry traces of every step and tool call, in CloudWatch |
| **Evaluations** | LLM-as-a-judge scoring of those traces |
| **Registry** | A catalog of agents, MCP servers, tools and skills across the org |
| **Payments** | Lets agents pay for x402-protected APIs and tools |

The workshop showed how these services fit together:

```text
                                                       any provider
                   +--------------------------+      +----------+  +--------+
  App        <---> | Runtime                  | ---> | Identity |  | Policy |
                   |  +--------------------+  |      +----------+  +--------+
  any model  <---> |  | any       | Prompt |  |            ^            ^
                   |  | framework | Tools  |  |  tools   +--------------------+
  any agent  <---> |  |           | Context|  | <------> | Gateway  (MCP)     |
  (A2A)            |  +--------------------+  |          +--------------------+
                   +-------------^------------+          | Browser            |
                                 |                       +--------------------+
                                 v                       | Code Interpreter   |
                   +--------------------------+          +--------------------+
                   | Memory                   |
                   +--------------------------+
  +--------------------------------------------------------------------------+
  | Observability                                                     (OTEL) |
  +--------------------------------------------------------------------------+
                                       ^
                                       v
  +--------------------------------------------------------------------------+
  | Evaluations                                                              |
  +--------------------------------------------------------------------------+
```

How to read it:

- **Runtime is the center, and it is open on three sides.** Your app calls it, it can use any model, and other agents can call it over A2A. Inside, any framework (Strands, LangGraph, CrewAI...) assembles the prompt, the tools and the context.
- **Memory hangs off Runtime.** The agent reads and writes context across turns and sessions.
- **Tools live outside the agent.** Gateway exposes APIs as MCP tools, and Browser and Code Interpreter are managed sandboxes. The agent reaches all of them the same way.
- **Identity and Policy sit above the tools.** Runtime uses Identity to authenticate callers, Gateway uses it to get credentials for the downstream API ("any provider": Google, Salesforce, GitHub...), and Policy decides whether a tool call is allowed at all.
- **Observability spans everything** through OpenTelemetry, and Evaluations scores the agent from those same traces.

The services are decoupled. A LangGraph agent on EKS can use AgentCore Memory and Gateway without touching Runtime.

---

## 2. Harness vs Runtime: who owns the loop?

This is the first decision, and it is the one that matters most.

| | Harness | Runtime |
|---|---|---|
| You provide | Configuration (model, prompt, tools, skills, memory, limits) | Agent code + an ARM64 container |
| Agent loop | Managed (Strands under the hood) | You write it, any framework |
| Change model / add a tool | Config change, no redeploy. Can even be overridden per call | Code change + redeploy |
| Best for | Getting an agent running fast, multi-tenant setups, A/B testing models | Custom loop control, graph/workflow patterns, bidirectional streaming, hooks |

AWS's guidance is to start with Harness and move to Runtime only when configuration stops being enough. Both run on the same infrastructure: every session gets its own **isolated, stateful microVM** with its own filesystem and shell, so one user's session can't see another's.

> Classic **Bedrock Agents** (the `bedrock-agent` action-group service) is in maintenance mode and closed to new customers. New work should use AgentCore. Existing agents have a [migration path to Harness](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-classic-maintenance-mode.html).

---

## 3. Strands: the loop in a few lines

Most of the AWS workshop was hands-on with [Strands Agents](https://strandsagents.com), the open-source SDK AWS uses inside Harness. It is a good place to start because the whole agent loop fits in a few lines of Python.

What `agent("...")` does on each call:

```text
  user prompt
       |
       v
+---------------------------------------------+
| Agent                                       |
|   system_prompt + conversation history      |
|                                             |
|   +-----------+   tool call   +----------+  |
|   |   model   | ------------> |  tools   |  |
|   | (Bedrock) | <------------ | (@tool)  |  |
|   +-----------+  tool result  +----------+  |
|         |                                   |
|         | no more tool calls (end_turn)     |
+---------|-----------------------------------+
          v
   AgentResult (final message, stop reason, token usage)
```

The model decides at each step whether to call a tool or answer. The loop ends when it answers without a tool call. Without tools, as in the examples below, it is a single model call plus the history.

```bash
pip install strands-agents
```

```python
from strands import Agent

agent = Agent()

response = agent("Describe the Amazon Bedrock service")
print(response)
```

With no arguments, `Agent()` uses a default Claude model on Bedrock, so you need AWS credentials and model access in the account's region. The call runs the full loop: the model answers, and if it had tools it would call them and loop until it is done.

The next step in the workshop was choosing the model explicitly and giving the agent an identity:

```python
from strands import Agent
from strands.models import BedrockModel

model = BedrockModel(model_id="amazon.nova-micro-v1:0")

agent = Agent(
    model=model,
    system_prompt="You are an AWS conversational assistant.",
    name="chatbot_aws",
    description="AWS conversational assistant.",
)

print(agent("Describe the Amazon Bedrock service"))
```

Two things to watch if you copy this code from the workshop slides:

- **Keyword arguments are lowercase** (`model`, `name`, `description`). The slides wrote `Model=` and `Name=`, which would fail with an unexpected-keyword error, and the curly quotes (`“...”`) are not valid Python.
- **Model IDs vs inference profiles.** Many newer Bedrock models only accept on-demand calls through a cross-region inference profile (e.g. `us.amazon.nova-micro-v1:0`). If the plain model ID returns a `ValidationException` about on-demand throughput, switch to the profile ID.

`name` and `description` look cosmetic here, but they matter once agents call other agents (A2A, agent-as-tool): they are what the calling agent reads to decide whether to delegate. This same `Agent` is what you deploy to Runtime in section 5, or what Harness builds for you from config in section 4.

---

## 4. Harness: an agent from configuration

The workshop described Harness as a **fully managed, declarative agent**: you define the model, the tools and the instructions in one configuration, and AWS runs the agent loop.

| Feature | What it means in practice |
|---|---|
| **Zero code, only configuration** | You declare model, prompt, tools and memory; Harness runs the agentic loop end to end. No container, no entrypoint |
| **Multiple model providers** | Amazon Bedrock, OpenAI, Google Gemini, or any provider LiteLLM supports |
| **Isolated microVM sessions** | Each session runs in its own microVM, and it auto-scales from zero to thousands of sessions |
| **CLI or SDK (boto3)** | The AgentCore CLI for quick prototyping, the AWS SDK for programmatic use |
| **Synchronous, streaming and long-running** | Interactive real-time answers, or background tasks of up to 8 hours (the same microVM limit as Runtime, section 5) |
| **Built-in observability** | Automatic dashboards, anomaly detection and notifications when a run completes |

The rest of this section shows what that looks like in practice.

The fastest path is the AgentCore CLI:

```bash
npm install -g @aws/agentcore@preview

agentcore create --name myresearchagent --model-provider bedrock
agentcore deploy
agentcore invoke --harness myresearchagent --session-id "$(uuidgen)" "Hello, what can you do?"
```

The same thing through the API takes three steps: **create**, **wait for `READY`**, **invoke**. Only a name and an execution role are required, but set the execution limits yourself. They are what stops a runaway loop from running up the bill.

```bash
aws bedrock-agentcore-control create-harness \
  --harness-name "ResearchAgent" \
  --execution-role-arn "arn:aws:iam::<account>:role/<HarnessRole>" \
  --max-iterations 25 \
  --max-tokens 4096 \
  --timeout-seconds 300

# poll until "status": "READY" (CREATING -> READY)
aws bedrock-agentcore-control get-harness --harness-id "<harnessId>"
```

The rest of the agent is declarative. A fuller config looks like this:

```jsonc
{
  "model": { "bedrockModelConfig": {
    "modelId": "<model-id>",
    "maxTokens": 4096,
    "temperature": 0.2
  }},
  "systemPrompt": [ { "text": "You are a research assistant. Cite your sources." } ],
  "tools": [
    { "type": "agentcore_code_interpreter", "config": { "agentCoreCodeInterpreter": {} } },
    { "type": "agentcore_gateway", "config": { "agentCoreGateway": { "gatewayArn": "<gateway-arn>" } } },
    { "type": "remote_mcp", "name": "docs", "config": { "remoteMcp": { "url": "https://mcp.example.com/mcp" } } }
  ],
  "skills": [
    { "git": { "url": "https://github.com/example/skills-repo", "path": "research" } }
  ]
}
```

A few things to note:

- **Models are not limited to Bedrock.** `openAiModelConfig`, `geminiModelConfig` and `liteLlmModelConfig` work too. The provider API key lives in AgentCore Identity and is referenced by ARN, never inline.
- **Skills** use the open [Agent Skills](https://agentskills.io) format (`SKILL.md` + scripts), the same one Claude Code uses. They can come from Git, S3, the session filesystem, or AWS's prebuilt skills.
- **Built-in tools** include `shell` and `file_operations` inside the microVM.

Invocation happens on the data plane (`bedrock-agentcore`, not `-control`) and returns a **stream** of events:

```python
import uuid
import boto3

client = boto3.client("bedrock-agentcore", region_name="us-east-1")

session_id = str(uuid.uuid4())  # must be >= 33 chars; a hyphenated UUID is 36

response = client.invoke_harness(
    harnessArn="<harness-arn>",
    runtimeSessionId=session_id,
    messages=[{"role": "user", "content": [{"text": "Summarize the last AWS re:Invent agent launches"}]}],
)

for event in response["stream"]:
    if "contentBlockDelta" in event:
        delta = event["contentBlockDelta"].get("delta", {})
        if "text" in delta:
            print(delta["text"], end="", flush=True)
    elif "messageStop" in event:
        print(f"\n[stop: {event['messageStop']['stopReason']}]")
```

Reuse the same `runtimeSessionId` to continue the conversation in the same microVM. The `stopReason` tells you why the loop ended: `end_turn` means it finished normally, while `max_iterations_exceeded` and `timeout_exceeded` mean one of your limits cut it off.

**Per-invocation overrides** are what make Harness useful beyond prototyping. `model`, `systemPrompt`, `tools`, `skills` and the limits can all be overridden on a single `invoke_harness` call. You can A/B test two models on live traffic without deploying anything.

**Versions and endpoints**: every update creates an immutable version, and named endpoints point at versions. To roll back, point the endpoint at the previous version. Nothing gets rebuilt.

---

## 5. Runtime: bring your own loop

If you already have an agent in LangGraph, CrewAI, or Strands with custom hooks, Runtime hosts it as is. The workshop showed how small the change is, starting from the minimal agent of section 3:

```text
  minimal agent                          agent for AgentCore
  -------------                          -------------------
  from strands import Agent              from strands import Agent
                                       + from bedrock_agentcore.runtime import BedrockAgentCoreApp
                                       + app = BedrockAgentCoreApp()

  agent = Agent()                        agent = Agent()

                                       + @app.entrypoint
                                       + def invoke(payload):
  response = agent("Describe ...")           response = agent(payload.get("prompt"))
  print(response)                            return ...

                                       + if __name__ == "__main__":
                                       +     app.run()
```

Three additions, and the agent itself doesn't change:

1. **`BedrockAgentCoreApp()`** creates the HTTP server Runtime expects.
2. **`@app.entrypoint`** marks the function Runtime calls on every invocation. The request body arrives as `payload`, so the prompt now comes from the caller instead of being hardcoded.
3. **`app.run()`** starts the server, which also lets you test locally before deploying.

The complete file:

```python
# agent.py
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent

app = BedrockAgentCoreApp()
agent = Agent(system_prompt="You are a helpful assistant.")


@app.entrypoint
def invoke(payload: dict) -> dict:
    result = agent(payload.get("prompt", ""))
    return {"result": str(result)}


if __name__ == "__main__":
    app.run()
```

Compared with the slide, this version fixes the function body's indentation (the slide lost it), defaults the prompt to `""` instead of `None`, and returns a plain dict. The `AgentResult` object Strands returns is not plain JSON; `str(result)` gives the final text.

Test it locally before building anything:

```bash
python agent.py   # serves on http://localhost:8080

curl -s localhost:8080/ping
curl -s -X POST localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Describe the Amazon Bedrock service"}'
```

Runtime calls the same two endpoints, so a passing local test means the contract is right. What still changes on deploy is the environment: the execution role instead of your local credentials, and an ARM64 build.

`BedrockAgentCoreApp` implements the container contract for you. For the default **HTTP** protocol that means `GET /ping` for health and `POST /invocations` for work, on port 8080. Runtime supports four protocols, and you have to pick one before building the container:

| Protocol | Contract | Use when |
|---|---|---|
| **HTTP** | `/ping`, `/invocations` (JSON/SSE), port 8080 | Default; REST-style request/response |
| **MCP** | `/mcp` (streamable-http), port 8000 | The thing you're deploying *is* a tool server |
| **A2A** | `/.well-known/agent-card.json` + JSON-RPC at `/`, port 9000 | Agents calling agents |
| **AG-UI** | `/invocations` SSE event stream, port 8080 | Streaming agent state to a frontend |

Two common gotchas:

1. **On the container path, the image must be ARM64 (Graviton).** An x86 image won't start, and the error message doesn't make that obvious. On Apple Silicon you get ARM64 by default; in CI, use `docker buildx build --platform linux/arm64`.
2. **Creating a runtime is not enough.** You also need a runtime **endpoint**, and you have to wait for it to reach `READY` before the agent can take traffic.

```bash
aws bedrock-agentcore-control create-agent-runtime \
  --agent-runtime-name my_agent \
  --agent-runtime-artifact '{"containerConfiguration":{"containerUri":"<ecr-uri>"}}' \
  --role-arn <execution-role-arn> \
  --network-configuration '{"networkMode":"VPC", ...}' \
  --authorizer-configuration '...' \
  --protocol-configuration '{"serverProtocol":"HTTP"}'

aws bedrock-agentcore-control create-agent-runtime-endpoint \
  --agent-runtime-id <id> --name prod
```

The [AgentCore starter toolkit](https://github.com/aws/bedrock-agentcore-starter-toolkit) (`agentcore configure` / `agentcore launch`) does the Dockerfile, ECR push and runtime creation for you if you'd rather not run these steps yourself.

### The deployment flow

The workshop summed up the whole path from code to a live agent in one picture:

```text
  developer
      |
      v
+------------------------------------+
| Agent or tool code                 |
|   models:     Bedrock, Anthropic,  |
|               OpenAI, Gemini, ...  |
|   frameworks: Strands, LangGraph,  |
|               CrewAI, LlamaIndex...|
|   +                                |               AgentCore Runtime
|   AgentCore Runtime decorator      |            +-----------------------+
|   AgentCore Observability config   | configure  |                       |
|   AgentCore Identity config        | ---+       |  Runtime Agent        |
+------------------------------------+    |       |  (the versioned code) |
                                          |       |                       |
          +-------------------------------+       |  Runtime Endpoint     |
          |                                       |  (what clients call)  |
          +--> Dockerfile ----> Amazon ECR ---->  |                       |
          |                                       |                       |
          +--> ZIP upload ----> Amazon S3  ---->  |                       |
                                                  +-----------------------+
                                                             ^
                                                             | invoke
  user ----------> application ------------------------------+
```

Reading it left to right:

1. **Your code** is any model plus any framework, with three additions from AgentCore: the Runtime decorator (`@app.entrypoint`), Observability config (ADOT/OpenTelemetry) and Identity config (inbound authorizer, outbound credential providers).
2. **Two ways to package it.** A Docker image pushed to **ECR** (full control over the OS and dependencies, must be ARM64), or a **ZIP of your code uploaded to S3** (direct code deployment: no Dockerfile, AgentCore builds the environment for you). The ZIP path is the quicker one for a plain Python agent.
3. **Runtime creates two things:** the **Agent** (the code, versioned) and an **Endpoint** that points to a version. Clients only ever call the endpoint, which is why rolling back is just pointing it at an older version.
4. **Your application invokes the endpoint** on behalf of the user. The user never talks to Runtime directly.

### How you pay: only while the microVM is up

Each session runs in its own microVM, and that microVM is the billing unit:

- **You pay only while the session's microVM exists**, from the moment it is ready, through initialization, active processing and idle periods, until the session is terminated. No sessions, no bill. There is no always-on cluster like with ECS or EKS.
- **Billing is per second, on actual CPU and memory used** (1-second minimum, 128 MB minimum for memory). **CPU scales to zero during I/O wait**: waiting for the LLM, a tool/API call or a database query is not charged as CPU. That is most of an agent's life. Memory keeps being billed while the microVM is up, though Runtime v2 reclaims idle memory after 120 seconds.
- **A microVM lives up to 8 hours** (`maxLifetime`, default and maximum 28,800 s). Within that window, calls with the same `runtimeSessionId` hit the same microVM, with its filesystem and in-process state. At the limit the microVM is terminated; the session can continue, but on a new microVM.
- **Idle sessions are torn down earlier.** If nothing calls the session for 15 minutes (`idleRuntimeSessionTimeout`, default 900 s), the microVM is terminated and billing stops. Both values are set in the runtime's `lifecycleConfiguration`, from 60 s up to 8 h.

```bash
aws bedrock-agentcore-control update-agent-runtime \
  --agent-runtime-id <id> \
  --lifecycle-configuration '{"idleRuntimeSessionTimeout": 300, "maxLifetime": 3600}' \
  ...
```

The practical consequence: reuse session IDs for a real conversation, but don't keep sessions alive artificially, and lower the idle timeout if your users have short interactions. A session kept open "just in case" is memory you are paying for.

If you really need longer sessions (an agent that works on a task for days), Runtime also has an **Instances** compute type: AgentCore-managed EC2 instances in your account, billed as EC2 cost plus a management fee, with sessions up to 14 days.

Direct code deployment adds the ZIP's storage at S3 Standard rates; the container path pays for ECR storage instead.

---

## 6. Tools: Gateway, Code Interpreter, Browser

**Gateway** turns things that aren't MCP servers into MCP tools. You give it an OpenAPI spec, a Lambda function or an existing MCP server, and it exposes all of them through one MCP endpoint. Gateway builds the tool descriptions from the OpenAPI `description` fields, so the quality of those descriptions decides how well the agent picks tools.

```text
                                                       APIs, tools and resources
  agent                     +-----------+     +-----------------+     +--------+
  +------------+    /mcp    |           | --> | target:         | --> | tool 1 |  RESTful services
  | MCP client | ---------> | AgentCore |     | API endpoint    |     | tool 2 |  with an OpenAPI
  +------------+            |  Gateway  |     +-----------------+     | tool 3 |  schema
   list tools               |           |     +-----------------+     +--------+
   invoke tool              |           | --> | target:         | --> | tool 4 |
   search                   |           |     | AWS Lambda      |     | tool 5 |  Lambda functions
                            +-----------+     +-----------------+     | tool 6 |
                                                                      +--------+
```

From the agent's side there is only **one MCP server**, at the gateway's `/mcp` URL. It speaks three operations:

- **List tools** (`tools/list`): every tool from every target, merged into one catalog.
- **Invoke a tool** (`tools/call`): Gateway routes the call to the right target, translates the MCP arguments into the REST request or Lambda event, and adds the outbound credentials.
- **Search**: a built-in `x_amz_bedrock_agentcore_search` tool that returns only the tools relevant to a natural-language query (see below).

Each **target** is one backend, and one target can expose many tools: an OpenAPI spec turns each operation into a tool, and a Lambda target declares its tools in a schema. Adding a new API means adding a target; the agent's code does not change.

### Semantic tool search

Real services have a lot of operations. The workshop example had three targets with 250, 100 and 10 tools:

```text
                                                              +----------+
  without search                     +-----------+  <-------- | target 1 |  250 tools
    tools/list  -------------------> |           |            +----------+
                <--- 300+ tools ---- | AgentCore |            +----------+
                                     |  Gateway  |  <-------- | target 2 |  100 tools
  with search                        |           |            +----------+
    search: "create a social   ----> |           |            +----------+
             media post"             |           |  <-------- | target 3 |   10 tools
                <--- 4 most -------- |           |            +----------+
                     relevant tools  +-----------+
```

Without search, the agent lists the tools and gets **all 360** in its context: every name, description and JSON schema, on every turn. That is thousands of tokens before the user's question, and the model has to pick one out of hundreds of similar-looking options, which is exactly where tool selection gets worse.

With search, the agent asks in natural language and Gateway returns only the **4 most relevant** tools. The benefits, as the workshop put them:

- **Gateway indexes the tools automatically** and serves the semantic search serverless: it builds embeddings from each tool's name, description and parameters when a target is added or synced. No vector database to run.
- **Less context for the LLM**, which improves accuracy, speed and cost at the same time.
- **The agent focuses on the tools that matter** for the task at hand.

Search has to be enabled when the gateway is created:

```python
client.create_gateway(
    name="my-gateway",
    roleArn=gateway_role_arn,
    protocolType="MCP",
    protocolConfiguration={"mcp": {"searchType": "SEMANTIC"}},
    authorizerType="CUSTOM_JWT",
    authorizerConfiguration=auth_config,
)
```

and the agent calls it like any other MCP tool:

```json
{
  "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": {
    "name": "x_amz_bedrock_agentcore_search",
    "arguments": { "query": "create a social media post" }
  }
}
```

The same caveat as before applies, only stronger: search ranks tools by their descriptions. Vague OpenAPI `description` fields mean bad search results.

### Credentials for targets

The order of steps matters. **Create the credential provider before the gateway target**, or target creation fails with "credential provider not found":

```bash
# 1. the API key goes into AgentCore Identity (encrypted, stored in Secrets Manager by the service)
export API_KEY=...   # don't paste it on the command line
aws bedrock-agentcore-control create-api-key-credential-provider \
  --name weather-api --api-key "$API_KEY"

# 2. only then create the target pointing to the OpenAPI spec in S3
aws bedrock-agentcore-control create-gateway-target \
  --gateway-identifier <gateway-id> --name weather \
  --target-configuration '...' --credential-provider-configurations '...'
```

### Code Interpreter and Browser

**Code Interpreter** is a sandbox where the agent runs code: pandas over a CSV, a quick plot, checking its own arithmetic. **Browser** is a managed headless browser for sites that have no API. Both run isolated from your account's network unless you configure otherwise.

---

## 7. Memory

AgentCore Memory has two layers, and the important part is which calls are synchronous and which are not:

```text
                 agent deployment                       AgentCore Memory
             +----------------------+          +-----------------------------+
             | events               |   sync   | short-term memory           |   async   +------------+
+-------+    |   - messages         | -------> |   - conversations           | --------> | automatic  |
| agent |<-->|   - agent state      |          |   - session state           |           | memory     |
+-------+    |                      |   sync   |                             |           | extraction |
             | list events          | <------- |                             |           +------------+
             |                      |          +-----------------------------+                 |
             |                      |          | long-term memory            |   async         |
             |                      |          |   - semantic (facts)        | <---------------+
             | retrieve memory      |   sync   |   - user preferences        |
             | records              | <------- |   - summary                 |   batch API
             |                      |          |   - episodic                | <---------- hydrate
             +----------------------+          |   - custom strategy         |   long-term memory
                                               +-----------------------------+
```

- **Short-term memory** is the raw record: every message and agent-state update is written as an **event** (`CreateEvent`), and read back with `ListEvents`. Both are synchronous, so the next turn already sees the previous one. This is your multi-turn chat history.
- **Long-term memory** is what the service *extracts* from those events in the background, so writing an event never waits on it. It extracts the new information and consolidates it with what it already has, kept across sessions and scoped per user through an `actorId` and namespaces.
- **Retrieval is synchronous and semantic.** `RetrieveMemoryRecords` does a semantic search over the long-term records, so before answering "suggest running shoes" the agent can pull the user's size and favorite brand from a conversation weeks ago.
- **Hydration**: a batch API lets you load long-term memory directly, e.g. preferences from your CRM before the user's first conversation, so the agent doesn't start from zero.

What gets extracted depends on the **strategies** you enable on the memory resource:

| Strategy | What it keeps | Example |
|---|---|---|
| **Semantic** | Facts and knowledge from the conversation | "The order #123 shipped to Recife" |
| **User preferences** | Explicit and implicit preferences | "Prefers deployments in us-east-1" |
| **Summary** | A running summary per session | "User debugged a VPC timeout, fixed with a NAT gateway" |
| **Episodic** | What happened in an interaction, plus reflections on what worked | "Querying Cost Explorer first answered the cost question" |
| **Custom** | Your own extraction prompt and model on top of a built-in strategy | Domain-specific entities |

Since extraction is asynchronous, a fact said in this turn usually isn't retrievable as a long-term record on the next one. Within a session, rely on the short-term events; long-term memory pays off in the *next* session.

With Harness, memory is just config: `managedMemoryConfiguration` for a managed store, `agentCoreMemoryConfiguration` with your own memory ARN, or `disabled` for stateless agents. With Runtime, the SDK gives you hooks that save the conversation and retrieve relevant long-term records before each turn.

Session memory is conversation history, so expect PII in it. Encrypt it with a customer-managed KMS key and keep the TTL as short as your use case allows.

---

## 8. Identity: the three OAuth layers

This is the part people mix up most. The workshop drew every hop where someone has to prove who they are:

```text
                                  agent needs AWS resources
                              +--> [agent outbound auth: IAM] ---------> AWS resources / agents
                              |
  user                        |   agent needs a tool behind Gateway
   |                          +--> [agent outbound auth:     ] --> [gateway inbound auth ]
   v              +---------+ |    [OAuth / API key        ]      [AgentCore Gateway   ]
  app ----------> |[inbound]| |                                   [gateway outbound auth]
   ^              | agent   |-+                                              |
   | OAuth token  | (hosted |                                                v
   |              |  or     | |   agent needs an external resource
  user's identity |  self-  | +--> [agent outbound auth:     ] ---> external resources / agents
  provider        |  hosted)|      [OAuth / API key        ]         (OAuth, API keys, ...)
                  +---------+
```

Reading it from the left:

1. **The user signs in with their own identity provider** (Cognito, Okta, Entra, Google...) and the app receives an OAuth token.
2. **Agent inbound auth**: the app calls the agent with that token, and the agent validates it before doing anything. It works the same whether the agent is hosted on AgentCore Runtime or self-hosted (EKS, Lambda, on-prem): Identity is a separate service.
3. **Agent outbound auth** has three destinations:
   - **AWS resources and other agents on AWS**: through IAM, using the execution role. No secrets involved.
   - **Tools behind AgentCore Gateway**: the agent presents an OAuth token or API key to the Gateway.
   - **External resources directly** (a SaaS API, an agent at another company): OAuth tokens or API keys that Identity fetches from its token vault, so they never sit in the agent's code or environment variables.
4. **Gateway does it again.** It has its own inbound auth (who may call these tools) and its own outbound auth (how it authenticates to the downstream API). That is why the credential provider has to exist before the Gateway target (section 6): the target needs it for its outbound hop.

The same thing, grouped by direction:

| Layer | Direction | Example |
|---|---|---|
| **Inbound** | Caller → agent | Your app's Cognito/Okta/Entra JWT is validated by the agent's `customJWTAuthorizer` |
| **Outbound** | Agent → external API | The agent gets a Google Calendar token *for this user* from the Identity token vault |
| **Service** | AgentCore → AWS | The execution role (IAM) |

A harness or runtime accepts **exactly one** inbound method: SigV4 (IAM) when no authorizer is configured, OAuth JWT when one is. There's no mixed mode. The important consequence: **per-user tokens for downstream tools only work on the JWT path.** With SigV4 the agent can't tell which end user is calling, so it can't act on their behalf.

When you configure the JWT authorizer, set `allowedAudience` and/or `allowedClients`. Without them, any valid token from that issuer is accepted, including tokens issued for a different app.

---

## 9. Policy: deterministic limits on tool calls

Identity answers *who* is calling. **Policy** (in preview at the time of the workshop) answers *what they are allowed to do*, and it does it outside the model. A system prompt saying "never refund more than $1,000" is a request; a policy is enforced.

```text
                     tool calls                                  allowed
  user --> agents and   requested   +-------------------+       tool calls    +--------------------+
           other MCP    --------->  | AgentCore Gateway | ------------------> | protected          |
           clients                  +-------------------+                     | resources          |
                                              ^                               | (tools, APIs,      |
                                              | allow / deny                  |  systems, data)    |
                                              v                               +--------------------+
  +------------------+     +------------------------------------------------+
  | AgentCore        | <-- | Policy in AgentCore                            |
  | Observability    |     |                         +--------------------+ |
  +------------------+     |  +-------------------+  | policy lifecycle   | |     policy
                           |  | dynamic policy    |  | management         | | <-> admin
                           |  | evaluation        |  +--------------------+ |
                           |  +-------------------+  | policy authoring   | |
                           |                         | (natural language  | |
                           |                         |  or Cedar)         | |
                           |                         +--------------------+ |
                           +------------------------------------------------+
```

How it works:

1. **Every tool call goes through Gateway**, whether it comes from your agent or any other MCP client.
2. **Before forwarding it, Gateway asks Policy**, which evaluates the call against the policies: who is calling, which tool, and with which arguments.
3. **Allowed calls reach the protected resource. Denied calls never do**, no matter how the model was convinced to make them (a prompt injection in a web page, a confused plan, a malicious user).
4. **Every decision goes to Observability**, so you can audit what was blocked and why.
5. **A policy admin** writes and manages the policies separately from the agent's code and prompt: in natural language, which is turned into Cedar, or directly in [Cedar](https://www.cedarpolicy.com).

A Cedar policy has a principal (who), an action (which tool) and a resource (which gateway), plus optional conditions on the tool's input:

```cedar
permit(
  principal,
  action == AgentCore::Action::"ApplicationToolTarget___create_application",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when {
  context.input.coverage_amount <= 1000000
};
```

The agent can create insurance applications, but only up to 1,000,000 of coverage. Above that the call is denied, and the agent has to tell the user it can't do it (or hand off to a human).

The three promises on the slide:

- **Bounded agent actions.** Agents act autonomously, but inside governance and compliance limits.
- **Instant and consistent.** Policies are evaluated in milliseconds, without slowing the agent down, and the same input always gets the same decision, unlike a model.
- **Provably correct.** It is built on Cedar, which AWS designed for automated reasoning: policies can be analyzed mathematically (e.g. "can any policy ever allow a refund above X?") instead of only tested.

Two Cedar rules worth knowing: **anything not explicitly permitted is denied**, and **a `forbid` always wins over a `permit`**. Start with a few narrow `permit`s for the tools the agent needs, and add `forbid`s for hard limits.

Policy only sees calls that go **through Gateway**. A tool implemented inside the agent's own code, or an API it calls directly, is not covered. If you want an action to be governed, put it behind Gateway.

---

## 10. Observability and evaluations

Observability gets telemetry from two places: from **your agent** (the framework's own spans) and from **the AgentCore services** it uses. The workshop slide numbered the three ways to wire it:

```text
  agent runtime
  +--------------------------------------+
  | framework (Strands, LangGraph,       |  (1) agent telemetry
  |  CrewAI, LlamaIndex...)        ADOT  | ------------------------+
  | 3P OTEL                              |                         |
  +--------------------------------------+                         v
     |       |                                          +----------------------+     +----------------------+
     |       |  service telemetry                       | Amazon Bedrock       |     | AgentCore            |
     |       +-> AgentCore Memory ---------+            | AgentCore            | --> | observability        |
     |       +-> AgentCore Identity -------+--- (3) --> | Observability        |     | dashboards           |
     |       +-> AgentCore Gateway --------+            | (CloudWatch)         |     | (sessions, traces,   |
     |       +-> Browser & Code Interp. ---+            +----------------------+     |  token usage...)     |
     |                                                    automatic chaining of      +----------------------+
     |                                                    the OTEL spans from the
     |                                                    agent and the services
     |                                                                               +----------------------+
     |  (2) agent telemetry via a third-party OTEL SDK                               | third-party          |
     +-----------------------------------------------------------------------------> | observability        |
                                                                                     | (Langfuse, Datadog)  |
                                                                                     +----------------------+
```

1. **Agent telemetry with ADOT → AgentCore Observability.** The default path. The ADOT (AWS Distro for OpenTelemetry) SDK picks up the spans the framework already emits (each model call, each tool call) and sends them to CloudWatch, where the AgentCore dashboards show sessions, traces and token usage per agent. On Runtime this is mostly configured for you; outside Runtime (EKS, Lambda, on-prem) you set the `OTEL_*` environment variables yourself.
2. **Or a third-party OTEL tool instead.** Because it is all OpenTelemetry, the same spans can go to Langfuse, Datadog, Arize and so on. On Runtime, set `DISABLE_ADOT_OBSERVABILITY=true` so the default ADOT configuration doesn't get in the way of your own exporter.
3. **Optionally, service-level traces.** Memory, Identity, Gateway, Browser and Code Interpreter can emit their own telemetry, and AgentCore Observability **chains** them to the agent's spans automatically. A slow answer then shows up as one trace: the model call, then the Gateway tool call, then the Memory retrieval, each with its own latency, instead of a gap you have to guess about.

One prerequisite trips people up: enable **CloudWatch Transaction Search** in the account once, or no spans show up in the dashboards.

Separately from the traces, Runtime publishes invocations, latency, errors, throttles and session counts to CloudWatch automatically. **Token usage is not published automatically.** For tokens and per-step traces, instrument the agent with the ADOT (AWS Distro for OpenTelemetry) SDK. The ADOT *Collector* is not supported for this; it has to be the SDK.

### Evaluations: LLM-as-a-judge on the traces

Observability tells you *what* the agent did. **Evaluations** (in preview at the time of the workshop) tells you whether it did it *well*, and it reads exactly the same traces:

```text
                +------------------------------+
  user <------> | agent                        |
                |   - - AgentCore Runtime      |         +----------------------------+
                |   - - AgentCore Memory       |         | AgentCore Evaluations      |   on-demand
                |   - - AgentCore Gateway      |         |                            | <------------+
                +------------------------------+         |  call the LLM judge        |              |
                               |                         |  for each metric           |          agent owner
                               | traces                  |            |               |    (picks evaluators,
                               v                         |            v               |     watches scores)
                +------------------------------+  read   |  write the results with    |              ^
                | AgentCore Observability      | ------> |  the judge's explanation   |              |
                |                              | <------ |                            |              |
                +------------------------------+  scores +----------------------------+              |
                               |                                                                     |
                               +---------------- dashboards: score over time ------------------------+
```

1. **The agent runs normally** and its traces (model calls, Memory, Gateway tool calls) land in Observability.
2. **Evaluations reads those traces and calls an LLM judge once per metric.** Each metric is a separate judgment, scored on its own scale.
3. **It writes the score back with the judge's explanation**, so a low "correctness" comes with *why* it was judged wrong. That explanation is what makes the score actionable.
4. **The agent owner** picks the evaluators and watches the scores over time in the dashboards (the workshop showed a per-day chart of scores for an intent-resolution metric).

The evaluators you pick from, grouped as in the console:

| Group | Evaluators (examples) | Question it answers |
|---|---|---|
| **Response quality** | Correctness, Helpfulness, Conciseness, Instruction following... | Is the answer right, useful, short enough, and does it follow the system prompt? |
| **Task completion** | Goal success rate | Did the conversation achieve what the user wanted? |
| **Component-level** | Tool selection accuracy... | Did the agent call the right tool for the step? |
| **Safety** | Harmfulness... | Does the response contain harmful content? |
| **Custom** | Your own judge prompt, or code (e.g. a Lambda) | Domain rules: schema validity, required disclaimers, no PII |

Two ways to run them:

- **On-demand**: evaluate a specific set of sessions when you ask, e.g. before and after a prompt change, as a regression test.
- **Online**: a configuration that continuously samples live traffic (from 0.01% to 100% of sessions) and scores it on a schedule. Scores also become CloudWatch metrics, so you can **alarm** when, say, correctness drops after a deploy.

Things to keep in mind:

- **No traces, no evaluation.** If the agent isn't instrumented, or the spans lack input/output/tool attributes, there's nothing to judge.
- **Every judgment is an LLM call.** Sample: you don't need to judge every session, and 5–10% of real traffic is usually enough to see trends.
- **Set the session timeout** of an online config to your agent's real session length, or it will score conversations that are still in progress.
- **A judge is a model, not ground truth.** Read some of the explanations before trusting a trend, especially for custom evaluators.

---

## 11. Putting it together: the workshop's customer support agent

The hands-on lab built one agent that uses almost every service in this post: a customer support agent that answers questions about products, returns, warranties and refunds.

```text
                                  AWS Cloud
          local env      +---------------------------------------------------+
          +-------+      | AgentCore Runtime                                 |        Exa MCP server
  user <->| Flask |<---->|  +----------------+   local tools:                |  task  +------------------------+
          +-------+      |  | customer       |--> 1 get_return_policy()      |------->| 3 web_search_exa()     |
              :          |  | support agent  |--> 2 get_product_info()       |        | 4 get_code_context_exa |
              :          |  | (Strands)      |                               |        | 5 crawling_exa()       |
              :          |  +----------------+                               |        +------------------------+
              :          +-----:---------:------------:-----------|----------+
              :                :         :            :           | task           send traces
              :     invoke LLM :         : session +  : authn     v               - - - - - - - - - +
              :                v         v history    :   +-----------------+                       v
              :      +----------+  +----------+       :   | AgentCore       |<- -> AgentCore   +---------------+
              :      | Bedrock  |  | AgentCore|       :   | Gateway         |      Policy      | AgentCore     |
              :      | LLMs     |  | Memory   |       :   +-----------------+                  | Observability |
              :      +----------+  +----------+       :      :           :                    +---------------+
              :                                       :      v           v                           : online
              : authenticate user                     :  6 check_     7 process_                     v eval config
              v                                       v    warranty()    refund()            +---------------+
          +-----------------+   propagate      +-----------+  (Lambda)    (Lambda)            | AgentCore     |
          | Amazon Cognito  | ---------------> | AgentCore |<- - - - - - - - - -:              | Evaluations   |
          +-----------------+   credentials    | Identity  |   authenticate tool calls          +---------------+
                                               +-----------+
```

Following a question through it:

1. **The user signs in** through a local Flask app, which authenticates against **Amazon Cognito** and gets a JWT.
2. **Flask calls the agent on Runtime** with that token. **Identity** validates it (inbound auth, section 8) and propagates the user's credentials, so later tool calls happen on behalf of *this* user.
3. **The agent** (Strands on Runtime, section 5) **invokes a Bedrock LLM** for each step and **reads the session and previous interactions from Memory** (section 7), so a returning customer doesn't have to repeat their order number.
4. **It picks a tool**, and the seven tools are deliberately spread over three kinds:

| Tool | Where it lives | Why there |
|---|---|---|
| 1 `get_return_policy()`, 2 `get_product_info()` | Inside the agent's code (`@tool`) | Read-only, no credentials, no need for governance |
| 3 `web_search_exa()`, 4 `get_code_context_exa()`, 5 `crawling_exa()` | Exa's remote MCP server | Third-party capability (web search) the agent consumes as is |
| 6 `check_warranty()`, 7 `process_refund()` | Lambda functions behind **Gateway** | Touch customer data and **money**: they need authenticated calls and limits |

5. **Calls to tools 6 and 7 go through Gateway**, which asks **Policy** first (section 9). This is where a rule like "no refunds above X without a human" lives, not in the prompt. Gateway then authenticates to the Lambdas through **Identity** (outbound auth).
6. **Everything sends traces to Observability**, and an **online evaluation configuration** has **Evaluations** score a sample of the conversations (section 10).

The split in step 4 is the main design lesson of the lab: **put a tool behind Gateway when it needs credentials, an audit trail or a policy**, and keep the rest as plain local tools. `process_refund()` inside the agent's code would work just as well in a demo, but nothing outside the model would stop it from refunding the wrong amount.

---

## 12. Production checklist

What I'd verify before putting real users on an agent:

- [ ] **Limits set explicitly**: `maxIterations`, `maxTokens`, `timeoutSeconds`. Every session is a microVM with a shell, so an unbounded caller is a cost problem.
- [ ] **Authorizer on**. No unauthenticated runtime or harness outside a sandbox account.
- [ ] **VPC mode** for production. Note: Harness pulls its image from ECR Public, which has no VPC endpoint, so a VPC-mode harness needs a NAT gateway or sessions fail on image pull.
- [ ] **Least-privilege execution role**, with `aws:SourceAccount` / `aws:SourceArn` in the trust policy, model access scoped to specific inference profiles, and one role per agent.
- [ ] **Hard limits in Policy, not in the prompt.** Anything with money, deletes or PII goes behind Gateway with a Cedar policy.
- [ ] **Treat caller overrides as untrusted.** If end users reach `invoke_harness` through your backend, strip or allowlist `model`, `skills` and `tools`. Skills are injected as trusted context, scripts included.
- [ ] **No secrets in `environmentVariables`** (they're readable with `get-harness` / `get-agent-runtime`). Use Identity credential providers or Secrets Manager.
- [ ] **KMS on CloudWatch log groups** and a retention policy. Prompts, responses and tool I/O all end up there.
- [ ] **Rate limiting** (API Gateway + WAF) in front of anything public.

---

## 13. When to use it, when not to

**Use AgentCore when** you're already on AWS and the hard part is everything around the loop: multi-tenant isolation, per-user OAuth to third-party tools, audit trails, rolling back a bad prompt in seconds. Harness in particular removes most of the code for a standard tool-using agent.

**Skip it when** your "agent" is a single LLM call with structured output (just call the Converse API), or when you need the loop to run somewhere AWS isn't. It's also worth comparing the per-session microVM cost against a plain Lambda for short, stateless, high-volume calls.

Mostly AgentCore saves you from building the platform yourself: session isolation, a credential vault, memory extraction, tracing. Agents mostly need that layer once they leave a notebook.

---

## References

- [What is Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html)
- [Strands Agents documentation](https://strandsagents.com)
- [AgentCore Harness](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness.html) / [Harness vs Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-vs-runtime.html)
- [Harness security and access controls](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-security.html)
- [AgentCore Memory types](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-types.html)
- [Build reliable AI agents with AgentCore Evaluations](https://aws.amazon.com/blogs/machine-learning/build-reliable-ai-agents-with-amazon-bedrock-agentcore-evaluations/)
- [AgentCore Policy](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html)
- [AgentCore Runtime lifecycle settings](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-lifecycle-settings.html) / [AgentCore pricing](https://aws.amazon.com/bedrock/agentcore/pricing/)
- [AgentCore endpoints and quotas](https://docs.aws.amazon.com/general/latest/gr/bedrock_agentcore.html)
- [Bedrock Agents classic maintenance mode](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-classic-maintenance-mode.html)
- Related posts: [LLM: MCP Server with FastAPI/FastMCP](../../../2026/02/07/llm-mcp.html)
