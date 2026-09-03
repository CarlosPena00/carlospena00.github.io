---
layout: post
title: "Anthropic Developer Certification: Como passei na prova"
author: Carlos Pena
date: 2026-08-15
lang: pt-br
---

<style>
.qbox{margin:1.6em 0;display:flex;flex-direction:column;gap:.75em;
  --qsurface:#fff;--qrule:#d2d8e0;--qaccent:#1b3a6b;--qmuted:#5a6472;
  --qright:#2f7a5a;--qright-bg:#e4f0ea;--qmine:#b4432e;--qmine-bg:#f7e7e2;
  --qmono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.qbox .stem{background:var(--qsurface);border:1px solid var(--qrule);
  border-left:3px solid var(--qaccent);border-radius:8px;padding:16px;margin:0;
  font-size:.92rem;line-height:1.5}
.qbox .stem code{font-size:.88em}
.qbox .src{display:block;font-family:var(--qmono);font-size:.62rem;font-weight:700;
  letter-spacing:.13em;text-transform:uppercase;color:var(--qmuted);margin-bottom:.6em}
.qbox .opts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.55em}
.qbox .opt{display:grid;grid-template-columns:auto 1fr auto;gap:.85em;align-items:start;
  border:1px solid var(--qrule);border-radius:8px;padding:.7em .9em;
  background:var(--qsurface);font-size:.92rem;line-height:1.45}
.qbox .opt .k{font-family:var(--qmono);font-weight:700;font-size:.8rem;width:1.7em;height:1.7em;
  border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
  flex:none;color:#fff;background:var(--qmuted)}
.qbox .opt .tag{font-family:var(--qmono);font-size:.62rem;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;white-space:nowrap;align-self:center}
.qbox .opt.mine{border-color:var(--qmine);background:var(--qmine-bg)}
.qbox .opt.mine .k{background:var(--qmine)}
.qbox .opt.mine .tag{color:var(--qmine)}
.qbox .opt.right{border-color:var(--qright);background:var(--qright-bg)}
.qbox .opt.right .k{background:var(--qright)}
.qbox .opt.right .tag{color:var(--qright)}
@media (max-width:600px){
  .qbox .opt{grid-template-columns:auto 1fr;gap:.6em}
  .qbox .opt .tag{grid-column:2;align-self:start}
}
</style>

Passei na certificação de desenvolvedor da Anthropic. Este post não é um guia de estudo:
é o registro dos meus erros e do que cada um deles me ensinou.

O padrão dos erros foi consistente o bastante para virar o fio condutor do texto. Em
quase toda questão que errei, eu marquei a alternativa **verdadeira** - mas que não
atacava a **causa raiz**. Havia sempre uma opção que era um fato correto sobre o sistema
e outra, menos óbvia, que resolvia o problema descrito no enunciado. Foi só quando esse
padrão ficou claro que minha nota começou a subir.

Os enunciados reproduzidos aqui são do **simulado**, não da prova real - e de
cada questão eu mostro só o enunciado e as duas alternativas que interessam à discussão,
a que eu marquei e a correta. Traduzi tudo para português; a prova e o simulado
existem só em inglês. É o simulado que mostra a resposta certa junto com a
explicação do erro, e foi lendo essas explicações que o padrão apareceu. Sobre a prova em si eu falo mais adiante, sem
reproduzir questões.


---

## As opções de hoje

A oferta mudou desde que eu prestei. Hoje são quatro certificações Claude, e a escolha
entre elas importa mais do que parece - os domínios cobrados são bem diferentes.

Todas compartilham o mesmo formato base: **120 minutos**, em **inglês**, válidas por
**12 meses**, aplicadas online com proctoring ou em centro de testes Pearson.

O que muda é o número de questões, o preço e - principalmente - o peso de cada domínio.

| Certificação | Nível | Questões | Preço |
|---|---|---|---|
| Claude Certified Associate - Foundations | Foundations | 60 | US$ 99 |
| Claude Certified Developer - Foundations | Foundations | 53 | US$ 125 |
| Claude Certified Architect - Foundations | Foundations | 60 | US$ 125 |
| Claude Certified Architect - Professional | Professional | 63 | US$ 175 |

**Retake:** reprovando, há carência antes de tentar de novo - 14 dias após a primeira
reprovação, 30 após a segunda e 90 após a terceira. São no máximo 4 tentativas por
período móvel de 12 meses, contadas por prova: reprovar em uma não impede se inscrever
em outra. A taxa é cobrada a cada tentativa - inclusive em caso de no-show ou atraso
além da tolerância, que ainda exigem nova inscrição.

Uma observação que vale: quando eu prestei, a carência era de **6 meses**.

### Os domínios de cada prova

**Claude Certified Associate - Foundations**

| Domínio | Peso |
|---|---|
| Output Evaluation and Validation | 21% |
| Workflow Integration and Solution Design | 16% |
| Governance, Risk, and Responsible Use | 15% |
| Prompting and Task Execution | 14% |
| Product and Model Selection | 12% |
| Configuration and Knowledge Management | 12% |
| Troubleshooting and Optimization | 10% |

**Claude Certified Developer - Foundations**

| Domínio | Peso |
|---|---|
| Applications and Integration | 33,1% |
| Model Selection and Optimization | 16,8% |
| Agents and Workflows | 14,7% |
| Prompt and Context Engineering | 11,0% |
| Tools and MCPs | 10,6% |
| Security and Safety | 8,1% |
| Claude Code | 3,1% |
| Eval, Testing, and Debugging | 2,6% |

**Claude Certified Architect - Foundations**

| Domínio | Peso |
|---|---|
| Agentic Architecture & Orchestration | 27% |
| Claude Code Configuration & Workflows | 20% |
| Prompt Engineering & Structured Output | 20% |
| Tool Design & MCP Integration | 18% |
| Context Management & Reliability | 15% |

**Claude Certified Architect - Professional**

| Domínio | Peso |
|---|---|
| Integration | 19% |
| Solution Design & Architecture | 17% |
| Evaluation, Testing & Optimization | 16% |
| Governance, Safety & Risk Management | 14% |
| Stakeholder Communication & Lifecycle Management | 14% |
| Claude Models, Prompting & Context Engineering | 13% |
| Developer Productivity & Operational Enablement | 7% |

### O que os pesos revelam

Duas leituras que mudam onde vale investir tempo.

**Claude Code pesa de forma muito diferente entre as trilhas.** Na Architect -
Foundations, "Claude Code Configuration & Workflows" vale 20% da prova. Na Developer -
Foundations, "Claude Code" vale 3,1% - o penúltimo domínio da lista. Estudar Claude Code
a fundo converte em nota na trilha Architect; na Developer, quase não move o ponteiro.

**Foundations cobra construção; Professional cobra decisão.** Na Architect -
Professional, governança e comunicação com stakeholders somam 28% - assuntos que nem
aparecem como domínio próprio nas Foundations. A prova deixa de perguntar como montar e
passa a perguntar como justificar.

---

## Como eu estudei

Três fontes, nessa ordem:

1. Cursos sugeridos pela Anthropic, em especial [Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action)
2. Simulado oficial
3. Simulado de terceiros - [CertSafari](https://www.certsafari.com/anthropic/claude-certified-architect-foundations)


---

## A base

Se eu tivesse que resumir a prova inteira em uma frase: **o simples vence**.

A ordem importa. Comece pela solução mais simples e só escale quando ela estiver bem
feita **e** ainda assim falhar:

1. **Sempre primeiro** - few-shot examples e melhoria de prompt.
2. **Só depois** - trocar de modelo, RAG, fine-tuning.

Escalar antes de esgotar o passo anterior é o erro que a prova pune de forma mais
consistente. Em quase toda questão existe uma alternativa cara e sofisticada que até
funcionaria - e uma alternativa barata que resolve a causa raiz.

O inverso também vale: não superdimensione o que é simples. Alterar um valor
específico em um arquivo específico não precisa de plan mode nem de refinamento de
prompt. Seja direto.

---

## O simulado

Números concretos do simulado:

| Item | Valor |
|---|---|
| Escala de nota | 100 a 1000 |
| Nota de corte | 720 |
| Questões | 60 (4 cenários x 15) |
| Tempo | 70 minutos |

O ritmo do simulado é mais apertado que o da prova real: 60 questões em 70 minutos,
pouco mais de 1 minuto cada, contra 2 minutos na prova. Isso é ótimo para treinar
velocidade - mas, como conto adiante, não significa que o tempo sobre no dia.

Os quatro cenários são sempre os mesmos:

1. Code Generation with Claude Code
2. Customer Support Resolution Agent
3. Claude Code for Continuous Integration
4. Multi-Agent Research System

Minha evolução entre a primeira e a última tentativa:

| Cenário | 1ª tentativa | Última |
|---|---|---|
| Code Generation | 13/15 (87%) | 13/15 (87%) |
| Customer Support | 10/15 (67%) | 12/15 (80%) |
| Continuous Integration | 10/15 (67%) | 14/15 (93%) |
| Multi-Agent Research | 12/15 (80%) | 15/15 (100%) |
| **Total** | **744** (45/60) | **903** (54/60) |


---

## A prova

São 120 minutos. Terminei a primeira passada em torno de **90 minutos** e usei o resto revisando:
entreguei faltando **2 minutos**.

Vale registrar isso porque contraria a intuição. Mesmo com quase o dobro do tempo por
questão que o simulado dá, o tempo não sobrou. Três coisas explicam.

**As questões são longas.** Cada enunciado é um cenário completo - contexto de produção,
percentuais, o que já foi tentado - antes de chegar à pergunta de fato. Os enunciados
mais adiante neste post dão a dimensão: é normal ler dois parágrafos densos e só então
avaliar quatro alternativas que também são longas. Uma questão assim, isolada, não seria problema.
Uma atrás da outra, por 120 minutos, cansa.

**Boa parte das questões é ambígua.** É nítido que os enunciados são escritos por IA:
alternativas que se sobrepõem, cenários cheios de detalhe que não muda a resposta, e
mais de uma opção defensável. Você gasta tempo não resolvendo o problema, mas decidindo
o que a questão está perguntando.

**O vocabulário em inglês pesa.** A prova só existe em inglês, e aparecem termos
técnicos pouco conhecidos - não é o inglês de quem lê documentação todo dia. Mesmo
trabalhando com isso há anos, tem termo que você pode nunca ter cruzado.

### A recomendação

Estabeleça um limite interno de tempo por questão **antes** de começar, e respeite.

Divida o tempo total pelo número de questões: essa é a sua média. Trabalhe com um teto
abaixo dela - se estourar, marque a questão, escolha a melhor opção disponível e siga.
Foi mais ou menos o que acabei fazendo: fechei a primeira passada em 75% do tempo e
deixei 25% para revisão.

O que consome tempo não é a questão difícil. É a questão ambígua, em que você relê pela
quarta vez tentando adivinhar a intenção de quem escreveu. Essa é a hora de marcar e
seguir em frente.

O cansaço também é cumulativo: o teto de tempo protege mais no fim da prova, quando a
leitura já está pesando, do que no começo.

### O resultado não sai na hora

Esse foi o ponto que mais me incomodou, e o que menos aparece documentado.

Não existe consenso sobre o prazo: em alguns lugares se fala em 2 a 14 dias úteis, em
outros 5 a 14. Esperei os 14 dias úteis, não recebi nada, e mandei um email para a
Anthropic. O resultado chegou uns 3 dias depois.

Suspeito que seja efeito da fase de migração das certificações - a mesma que trocou os
nomes das trilhas - e que o prazo normalize. Mas fica o aviso: o retorno não é imediato,
e se estourar o prazo, cobrar por email funciona.

---

## As questões, por tópico

Para cada cenário escolhi as questões que mais mudaram meu modelo mental - com o que
eu marquei, qual era a correta, e por quê. Meus dois maiores saltos foram em CI e
Multi-Agent, e é neles que o padrão descrito na abertura fica mais evidente.

---

### Claude Code for Continuous Integration

67% na primeira tentativa, 93% na última. Foi onde mais evoluí.

#### Batch API não suporta loop de tools

<div class="qbox">
  <p class="stem"><span class="src">Enunciado traduzido · simulado</span>O componente de code review funciona de forma iterativa: o Claude analisa um arquivo alterado e pode então solicitar arquivos relacionados (imports, classes base, testes) via tool calling para entender o contexto antes de dar o feedback final. Sua aplicação define uma tool que permite ao Claude pedir o conteúdo de arquivos; o Claude invoca essa tool, recebe os resultados e continua a análise. Você está avaliando processamento em batch para reduzir custos de API. Qual é a principal restrição técnica ao considerar batch processing para esse workflow?</p>
  <ul class="opts">
    <li class="opt mine"><span class="k">D</span><span>A latência de até 24 horas do batch processing é lenta demais para feedback em pull request, embora, fora isso, o workflow funcionasse normalmente.</span><span class="tag">eu marquei</span></li>
    <li class="opt right"><span class="k">B</span><span>O modelo assíncrono impede executar tools no meio da requisição e devolver os resultados para o Claude continuar a análise.</span><span class="tag">correta</span></li>
  </ul>
</div>

O cenário: o code review chama uma tool para pedir arquivos relacionados, recebe o
resultado e continua a análise. A pergunta é qual a restrição técnica de usar Batch
API para baratear isso.

Eu marquei **D** - "latência de até 24h é lenta demais, embora o workflow pudesse
funcionar". A correta é **B** - "o modelo assíncrono impede executar tools no meio
da requisição".

O que aprendi: a alternativa D **é verdadeira** sobre latência, e por isso ela é
tentadora. Mas ela afirma junto que "o workflow poderia funcionar" - e não poderia.
O Batch API é fire-and-forget: não existe ponto onde você intercepta um `tool_use`,
executa a tool e devolve o `tool_result` para o Claude continuar. Não é uma questão
de velocidade, é de arquitetura. Qualquer loop agêntico iterativo é impossível em
batch, mesmo que a resposta voltasse em um segundo.

A regra que tirei disso: quando uma alternativa diz "X é lento, embora funcionasse",
pare e verifique se realmente funcionaria.

Acertei essa mesma questão numa tentativa seguinte - foi o erro que mais me ensinou.

#### Auto-review não corrige viés de confirmação

<div class="qbox">
  <p class="stem"><span class="src">Enunciado traduzido · simulado</span>Seu time usa o Claude Code para gerar sugestões de código, mas você nota um padrão: problemas sutis - otimizações de performance que quebram edge cases, limpezas que mudam o comportamento de forma inesperada - só aparecem quando outra pessoa do time revisa o PR. O raciocínio do Claude durante a geração mostra que ele considerou esses casos, mas concluiu que sua abordagem estava correta. Qual abordagem ataca diretamente a causa raiz dessa limitação de auto-revisão?</p>
  <ul class="opts">
    <li class="opt mine"><span class="k">D</span><span>Adicionar instruções explícitas de auto-revisão ao prompt de geração, pedindo que o Claude critique as próprias sugestões antes de finalizar a saída.</span><span class="tag">eu marquei</span></li>
    <li class="opt right"><span class="k">C</span><span>Fazer uma segunda instância independente do Claude Code revisar as mudanças sem ver o raciocínio de quem gerou.</span><span class="tag">correta</span></li>
  </ul>
</div>

O cenário: o Claude gera código com problemas sutis que só aparecem quando outra
pessoa revisa o PR. O raciocínio da geração mostra que ele **considerou** esses casos
e concluiu que estava certo.

Eu marquei **D** - adicionar instruções de autocrítica no próprio prompt de geração.
A correta é **C** - uma segunda instância independente do Claude Code revisando as
mudanças **sem ver o raciocínio de quem gerou**.

O que aprendi: autocrítica dentro do mesmo contexto herda o mesmo viés. O enunciado
diz explicitamente que o Claude já tinha considerado os edge cases e racionalizado a
decisão - pedir para ele criticar de novo, no mesmo contexto, chega na mesma conclusão.
O que quebra o viés é contexto novo, não mais instrução.

Na prática: rodar review em uma sessão limpa, ou em um subagent que não herda o
contexto, pega coisas que o auto-review inline nunca pega.

#### Confiança se perde mais rápido do que se reconstrói

<div class="qbox">
  <p class="stem"><span class="src">Enunciado traduzido · simulado</span>A análise do seu code review automatizado mostra variação significativa na taxa de falsos positivos entre as categorias de achados. Achados de segurança e correção têm 8% de falso positivo, os de performance têm 18%, os de estilo e nomenclatura têm 52% e os de documentação têm 48%. Pesquisas com os desenvolvedores indicam desconfiança crescente - muitos passaram a descartar achados sem ler, porque “metade está errada”. As categorias de alto falso positivo estão minando a confiança nas categorias precisas. Qual abordagem melhor restaura a confiança dos desenvolvedores enquanto melhora o sistema?</p>
  <ul class="opts">
    <li class="opt mine"><span class="k">A</span><span>Manter todas as categorias habilitadas e adicionar few-shot examples para melhorar a precisão de cada uma ao longo das próximas semanas.</span><span class="tag">eu marquei</span></li>
    <li class="opt right"><span class="k">C</span><span>Desabilitar temporariamente as categorias de alto falso positivo (estilo, nomenclatura, documentação) e rodar só as categorias de alta precisão enquanto os prompts são melhorados.</span><span class="tag">correta</span></li>
  </ul>
</div>

O cenário: a taxa de falso positivo do review automático varia muito por categoria -
8% em segurança e correção, 18% em performance, 52% em estilo e nomenclatura, 48% em
documentação. Os desenvolvedores passaram a descartar achados sem ler, porque "metade
está errada". As categorias ruidosas estão contaminando a credibilidade das boas.

Eu marquei **A** - manter todas as categorias ligadas e ir melhorando a precisão de cada
uma com few-shot ao longo das semanas seguintes. A correta é **C** - desligar
temporariamente as categorias de alto falso positivo (estilo, nomenclatura, documentação)
e rodar só as de alta precisão enquanto os prompts são corrigidos.

O que aprendi: essa é a questão que mais mudou meu jeito de pensar em ferramenta interna.
A alternativa A **ataca a causa raiz** - o problema é precisão, e few-shot melhora
precisão. Tecnicamente não há nada de errado nela. O que ela ignora é o prazo: durante as
semanas de melhoria, o time continua vendo 50% de ruído e continua descartando tudo -
inclusive os achados de segurança, que estavam certos em 92% das vezes.

Uma ferramenta que ninguém lê tem precisão efetiva de zero, por melhor que seja o modelo
atrás dela. Confiança se perde rápido e se reconstrói devagar, então a jogada certa é
sacrificar cobertura para preservar credibilidade - e religar as categorias depois de
consertadas.

---

### Code Generation with Claude Code

87% nas duas tentativas. Foi o cenário mais estável - e o que menos me ensinou,
justamente porque eu já usava isso todo dia.

#### A hierarquia do CLAUDE.md

<div class="qbox">
  <p class="stem"><span class="src">Enunciado traduzido · simulado</span>Seu time usa o Claude Code há vários meses. Recentemente, três desenvolvedores relatam que o Claude segue corretamente a diretriz “sempre inclua tratamento de erro abrangente”, mas um quarto desenvolvedor, que acabou de entrar, relata que o Claude não segue essa diretriz. Os quatro trabalham no mesmo repositório e estão com o código atualizado. Qual é a causa mais provável e a correção apropriada?</p>
  <ul class="opts">
    <li class="opt mine"><span class="k">C</span><span>O <code>~/.claude/CLAUDE.md</code> do novo desenvolvedor contém instruções conflitantes que sobrescrevem as configurações do projeto. Peça que ele remova a seção conflitante da configuração de nível de usuário.</span><span class="tag">eu marquei</span></li>
    <li class="opt right"><span class="k">A</span><span>A diretriz está nos arquivos <code>~/.claude/CLAUDE.md</code> dos desenvolvedores originais (nível de usuário), e não no <code>.claude/CLAUDE.md</code> do projeto. Mova a instrução para o arquivo de nível de projeto para que todos do time a recebam.</span><span class="tag">correta</span></li>
  </ul>
</div>

O cenário: três desenvolvedores têm o Claude seguindo a diretriz "sempre inclua
tratamento de erro abrangente". Um quarto, recém-chegado, reporta que o Claude não
segue. Todos no mesmo repositório, com o código atualizado.

Eu marquei **C** - o `~/.claude/CLAUDE.md` do novo dev tem instruções conflitantes.
A correta é **A** - a diretriz está no `~/.claude/CLAUDE.md` **dos três originais**,
e não no `.claude/CLAUDE.md` do projeto.

O que aprendi: eu procurei a causa no membro novo, porque ele era a anomalia. Mas o
enunciado diz que ele acabou de chegar - é improvável que já tenha configuração
pessoal conflitante. A anomalia real são os três que **funcionam**: eles carregam a
regra no arquivo pessoal, que ninguém mais tem.

A regra prática: se uma instrução precisa valer para o time, ela vive no
`.claude/CLAUDE.md` do projeto, versionado. Configuração pessoal que "funciona pra
mim" é exatamente o que faz onboarding quebrar sem ninguém entender por quê.

#### Prosa que já falhou duas vezes não melhora sendo mais precisa

<div class="qbox">
  <p class="stem"><span class="src">Enunciado traduzido · simulado</span>Você pediu ao Claude Code para implementar uma função que transforma respostas de API em um formato interno normalizado. Depois de duas iterações, a estrutura de saída ainda não corresponde ao esperado - alguns campos estão aninhados de forma diferente e os timestamps não estão no formato correto. Você vem descrevendo os requisitos em prosa, mas o Claude parece interpretá-los de um jeito diferente a cada vez. Qual é a abordagem mais eficaz para a próxima iteração?</p>
  <ul class="opts">
    <li class="opt mine"><span class="k">D</span><span>Reescrever os requisitos com maior precisão técnica, especificando o mapeamento exato dos campos, as regras de aninhamento e as strings de formato dos timestamps.</span><span class="tag">eu marquei</span></li>
    <li class="opt right"><span class="k">C</span><span>Fornecer de 2 a 3 exemplos concretos de entrada e saída mostrando a transformação esperada para respostas de API representativas.</span><span class="tag">correta</span></li>
  </ul>
</div>

O cenário: depois de duas iterações descrevendo requisitos em prosa, a saída ainda
não bate - campos aninhados errados, timestamp fora do formato.

Eu marquei **D** - reescrever os requisitos com mais precisão técnica, especificando
mapeamento de campos e formato de data. A correta é **C** - dar 2 ou 3 exemplos
concretos de entrada e saída.

O que aprendi: essa foi a que mais mudou como eu escrevo prompt. A alternativa D é o
instinto natural do engenheiro - "não fui claro o suficiente, vou detalhar mais". Mas
o método de comunicação já falhou duas vezes. Prosa, por mais precisa que seja,
continua sujeita a interpretação. Um par entrada/saída não é.

Hoje, quando a segunda tentativa falha, eu paro de descrever e mostro um exemplo.

**Também caiu neste cenário**, e vale saber:

- `context: fork` no frontmatter de uma skill roda ela em um subagent isolado, então a
  discussão não polui o histórico da conversa principal.
- Skill de projeto tem precedência sobre skill pessoal de mesmo nome. Para customizar
  sem afetar o time, o caminho é **renomear** (`/my-commit`), não sobrescrever - não
  existe `override: true`.

---

### Customer Support Resolution Agent

67% na primeira tentativa, 80% na última. Foi o cenário mais difícil pra mim, e o
único que ficou abaixo de 87% no fim.

#### O culpado é o seu prompt, não o modelo

<div class="qbox">
  <p class="stem"><span class="src">Enunciado traduzido · simulado</span>Os logs de produção revelam um padrão consistente: quando os clientes incluem “account” na mensagem (ex.: “I want to check my account for the order I placed yesterday”), o agente chama <code>get_customer</code> primeiro em 78% das vezes. Quando os clientes formulam pedidos parecidos sem “account” (ex.: “I want to check on the order I placed yesterday”), ele chama <code>lookup_order</code> primeiro em 93% das vezes. As descrições das tools são bem escritas e não ambíguas. Qual é a causa raiz mais provável dessa discrepância?</p>
  <ul class="opts">
    <li class="opt mine"><span class="k">C</span><span>O treinamento base do modelo cria associações entre a terminologia “account” e operações relacionadas a cliente, que se sobrepõem às descrições das tools</span><span class="tag">eu marquei</span></li>
    <li class="opt right"><span class="k">A</span><span>O system prompt contém instruções sensíveis a palavras-chave que direcionam o comportamento com base em termos como “account”, criando padrões não intencionais de seleção de tools</span><span class="tag">correta</span></li>
  </ul>
</div>

O cenário: quando o cliente escreve "account" na mensagem, o agente chama `get_customer`
primeiro em 78% dos casos. Sem a palavra "account", ele chama `lookup_order` primeiro em
93%. As descrições das tools são boas e não ambíguas. Qual a causa raiz?

Eu marquei **C** - associações do treinamento base entre "conta" e operações de cliente.
A correta é **A** - o system prompt tem instruções sensíveis a palavra-chave.

O que aprendi: essa foi a que mais me incomodou, porque eu errei por um instinto ruim -
culpar o modelo. A explicação da resposta desmonta isso com o próprio número do enunciado:
o agente acerta 93% das vezes quando a palavra não aparece. Ou seja, ele **interpreta a
intenção corretamente**. Um comportamento que muda de forma abrupta com uma palavra
específica é sinal de regra explícita em algum lugar - e o lugar é o seu system prompt.

A regra que levei: viés do modelo produz degradação difusa. Roteamento por palavra-chave
produz degrau. Se o gráfico tem degrau, procure a instrução, não o modelo.

#### Garantia determinística vence instrução

<div class="qbox">
  <p class="stem"><span class="src">Enunciado traduzido · simulado</span>Os dados de produção mostram que em 12% dos casos o seu agente pula <code>get_customer</code> completamente e chama <code>lookup_order</code> usando apenas o nome informado pelo cliente, o que às vezes leva a contas identificadas erradas e reembolsos incorretos. Qual mudança resolveria de forma mais eficaz esse problema de confiabilidade?</p>
  <ul class="opts">
    <li class="opt right"><span class="k">D</span><span>Adicionar um pré-requisito programático que bloqueia as chamadas de <code>lookup_order</code> e <code>process_refund</code> até que <code>get_customer</code> tenha retornado um ID de cliente verificado.</span><span class="tag">acertei</span></li>
  </ul>
</div>

O cenário: em 12% dos casos o agente pula `get_customer` e chama `lookup_order` só com o
nome informado pelo cliente, o que leva a conta trocada e reembolso errado.

Marquei **D** e acertei - um pré-requisito programático que **bloqueia** `lookup_order`
e `process_refund` até `get_customer` retornar um ID verificado.

O que aprendi: as outras três alternativas são todas formas de *pedir melhor* - reforçar
no system prompt, adicionar few-shot, criar um classificador de roteamento. Todas reduzem
a probabilidade do erro. Nenhuma elimina.

Quando a consequência é reembolso na conta errada, 12% não vira 2% - tem que virar 0%. E
0% só se consegue tirando a decisão do LLM e colocando em código.

#### Escalar para humano é decisão operacional, não emocional

<div class="qbox">
  <p class="stem"><span class="src">Enunciado traduzido · simulado</span>Depois de chamar <code>get_customer</code> e <code>lookup_order</code>, o agente já recuperou todos os dados disponíveis no sistema, mas ainda enfrenta incerteza. Qual situação representa o gatilho mais apropriado para chamar <code>escalate_to_human</code>?</p>
  <ul class="opts">
    <li class="opt mine"><span class="k">A</span><span>O cliente afirma que nunca recebeu o pedido, mas o rastreio mostra que ele foi entregue e assinado no endereço dele há três dias. O agente deve escalar porque apresentar evidência contraditória pode desgastar a relação com o cliente.</span><span class="tag">eu marquei</span></li>
    <li class="opt right"><span class="k">C</span><span>O cliente pede equiparação de preço com um concorrente. Suas políticas permitem ajuste por queda de preço no seu próprio site em até 14 dias, mas são silentes sobre preço de concorrente. O agente deve escalar para interpretação de política.</span><span class="tag">correta</span></li>
  </ul>
</div>

O cenário: depois de chamar `get_customer` e `lookup_order`, o agente já tem todos os
dados do sistema. Qual situação é o gatilho mais apropriado para `escalate_to_human`?

Eu marquei **A** - o cliente diz que não recebeu o pedido, mas o rastreio mostra entrega
assinada há três dias; escalar porque apresentar evidência contraditória pode desgastar a
relação. A correta é **C** - o cliente pede price match contra um concorrente, e a
política cobre queda de preço no site próprio em 14 dias mas é **silente** sobre preço de
concorrente.

O que aprendi: minha resposta escalava por receio de desgastar o cliente. A explicação
chama isso pelo nome - é evitação emocional, não necessidade operacional. No caso A o
agente tem o dado factual do rastreio e o procedimento padrão para comunicá-lo; não falta
nada para ele agir. No caso C falta **autoridade**: a política não cobre a situação, e o
agente não pode inventar política.

Os gatilhos de escalonamento precisam ser determinísticos:

- acabou o limite de iterações e o problema não foi resolvido;
- o cliente pediu um humano explicitamente;
- existe uma lacuna real de política ou de alçada, como em C.

O que **não** serve como gatilho é análise de sentimento ou qualquer julgamento
probabilístico do tipo "o cliente pode ficar irritado". É a mesma lógica da questão do
reembolso: quando o critério precisa ser confiável, ele sai do julgamento do LLM e vira
regra.

**Também caiu neste cenário**, com a mesma lógica: para normalizar formatos de dados
vindos de MCP servers de terceiros que você não controla, a resposta é um hook
`PostToolUse` interceptando o resultado - não documentar os formatos no system prompt e
torcer para o agente converter certo.

---

### Multi-Agent Research System

80% na primeira tentativa, 100% na última. Foi onde os erros tinham o padrão mais
claro: eu tratava sintoma, a resposta certa corrigia a origem.

#### Nome de tool ambíguo se resolve renomeando

<div class="qbox">
  <p class="stem"><span class="src">Enunciado traduzido · simulado</span>Os logs de produção revelam um padrão consistente: pedidos do tipo “analise o relatório trimestral que eu subi” são roteados para o agente de web search em 45% das vezes, em vez de irem para o agente de análise de documentos. Ao examinar as definições das tools, você descobre que o agente de web search tem uma tool <code>analyze_content</code> descrita como “analisa conteúdo e extrai informação chave”, enquanto o agente de análise de documentos tem uma tool <code>analyze_document</code> descrita como “analisa documentos e extrai informação chave”. Como você deve resolver esse roteamento errado?</p>
  <ul class="opts">
    <li class="opt mine"><span class="k">D</span><span>Adicionar few-shot examples ao prompt do coordenador mostrando o roteamento correto: “Usuário sobe relatório trimestral → agente de análise de documentos” e “Usuário pergunta sobre uma página web → agente de web search”.</span><span class="tag">eu marquei</span></li>
    <li class="opt right"><span class="k">C</span><span>Renomear a tool de web search para <code>extract_web_results</code> e atualizar sua descrição para “processa e retorna informação obtida de buscas na web e de URLs”.</span><span class="tag">correta</span></li>
  </ul>
</div>

O cenário: "analise o relatório trimestral que subi" é roteado para o agente de web
search em 45% dos casos. O agente de web search tem `analyze_content` ("analisa conteúdo
e extrai informação chave"); o de documentos tem `analyze_document` ("analisa documentos
e extrai informação chave").

Eu marquei **D** - few-shot no prompt do coordenador mostrando o roteamento correto.
A correta é **C** - renomear a tool para `extract_web_results` e reescrever a descrição
para citar buscas e URLs.

O que aprendi: leia as duas descrições em voz alta. Elas são quase a mesma frase. Nenhum
volume de few-shot conserta duas tools que se descrevem igual - o few-shot vira uma
tabela de exceções que quebra na primeira frase que você não previu.

O nome e a descrição da tool **são** o roteamento. Se o coordenador erra 45% das vezes,
o problema está no vocabulário, não no exemplo.

#### Subagent não deve engolir contexto de falha

<div class="qbox">
  <p class="stem"><span class="src">Enunciado traduzido · simulado</span>O subagent de web search dá timeout enquanto pesquisa um tópico complexo. Você precisa desenhar como essa informação de falha volta para o agente coordenador. Qual abordagem de propagação de erro melhor viabiliza uma recuperação inteligente?</p>
  <ul class="opts">
    <li class="opt mine"><span class="k">A</span><span>Implementar retry automático com backoff exponencial dentro do subagent, retornando um status genérico de “search unavailable” apenas depois de esgotadas todas as tentativas.</span><span class="tag">eu marquei</span></li>
    <li class="opt right"><span class="k">D</span><span>Retornar ao coordenador um contexto de erro estruturado, incluindo o tipo da falha, a query tentada, quaisquer resultados parciais e possíveis abordagens alternativas.</span><span class="tag">correta</span></li>
  </ul>
</div>

O cenário: o subagent de web search dá timeout. Como essa falha deve voltar para o
coordenador?

Eu marquei **A** - retry com backoff exponencial dentro do subagent, devolvendo um
"search unavailable" genérico depois de esgotar as tentativas. A correta é **D** -
devolver contexto estruturado: tipo da falha, query tentada, resultados parciais e
alternativas possíveis.

O que aprendi: minha resposta é o reflexo de engenharia de sistemas distribuídos, e em
um serviço comum ela estaria certa. Mas aqui o chamador é um **agente**, não um `except`.
Um status binário só permite a decisão binária de desistir. Contexto estruturado permite
reformular a query, seguir com resultado parcial, ou trocar de fonte.

A regra: em multi-agent, `try/except` que colapsa o erro em uma string genérica destrói
exatamente a informação que o coordenador usaria para se recuperar. Retry continua sendo
útil - mas o que sobe junto importa mais do que quantas vezes você tentou.

**Também caiu neste cenário**, e é o achado mais aplicável fora da prova: quando a
agregação de subagents passa de ~75K tokens, o agente de síntese cita bem os primeiros
15K e os últimos 10K, e ignora os 50K do meio. A correção não é resumir tudo para caber -
é colocar um **sumário de key findings no início** e usar cabeçalhos de seção explícitos
para o modelo navegar. Efeito de primazia é aliado, não inimigo.

---

## Detalhes de API que valem ter decorados

Dois pontos que não aparecem nos enunciados acima, mas são conhecimentos importantes: detalhe de API que não dá para deduzir na hora, ou você sabe ou você chuta.

**Os tipos de `tool_choice`.** Controlam se, e qual, tool o Claude pode chamar:

| Valor | Comportamento |
|---|---|
| `{"type": "auto"}` | O Claude decide se usa tool (padrão) |
| `{"type": "any"}` | Obriga a usar ao menos uma tool |
| `{"type": "tool", "name": "..."}` | Obriga a usar a tool indicada |
| `{"type": "none"}` | Proíbe o uso de tools |

Qualquer um deles aceita também `"disable_parallel_tool_use": true`, que limita a uma
tool por resposta - por padrão o Claude pode pedir várias de uma vez.

**Forçar saída em JSON via tool.** O padrão canônico: você declara uma tool cujo
`input_schema` é exatamente o formato desejado e força
`tool_choice: {"type": "tool", "name": "..."}`. O modelo é obrigado a chamar aquela tool,
e os argumentos chegam como JSON válido dentro do schema - você nunca faz parse de texto
livre.

Uma ressalva para quem for aplicar isso hoje: a API ganhou **structured outputs**
(`output_config.format`, ou `client.messages.parse()`), que resolve o mesmo problema
diretamente, sem o rodeio da tool. Para garantir os argumentos de uma tool de verdade,
existe `strict: true` na definição dela. A técnica acima continua funcionando, mas já
não é o caminho recomendado.

---

## Considerações

A prova em si foi interessante. Gostei muito de ver a Anthropic indo sempre na
preferência pela solução mais simples primeiro. Não é um detalhe de estilo: é o critério
que decide a resposta certa em boa parte das questões. Quase sempre existe a alternativa
sofisticada que até funcionaria, e a alternativa simples que ataca a causa raiz - e é a
segunda que pontua.

O outro eixo que aparece o tempo todo é o foco em estabelecer confiança do usuário.
A questão do reembolso é o exemplo mais claro: a resposta certa não é pedir ao modelo
que verifique o cliente, é **bloquear** a operação até a verificação ter acontecido.
Quando a consequência cai na conta de alguém, 12% de erro não vira 2% - tem que virar 0%.

E a confiança aparece nos dois sentidos: a do cliente no seu produto, e a do seu próprio
time na ferramenta que você entrega. A questão dos falsos positivos é esse outro lado -
não adianta o review acertar 92% em segurança se o time já parou de ler.

São dois princípios que valem bem além da prova.

Os slides da palestra baseada neste post estão
[aqui](https://claude.ai/code/artifact/c539ca42-bc16-41df-b9bb-cc77514d3bb9).

Qualquer dúvida, podem me perguntar: [carlospena.com.br](https://carlospena.com.br/)

---

Para a referência de features do Claude Code - `CLAUDE.md`, hooks, MCP servers, skills -
veja [Claude Code in Action]({% post_url 2026-01-16-claude-code-in-action %}).
