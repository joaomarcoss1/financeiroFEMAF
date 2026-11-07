# F6 + F7 — Protocolos Acadêmicos e Documentos com Assinatura

Especificação de implementação para o Plataforma de Gestão Financeira FEMAF. Escrita a partir do código deste
repositório, do banco real do projeto (inspecionado em 05/11/2026, só leitura) e do documento
"Mapeamento e Otimização dos Fluxos de Tramitação" (PROTOCOLOS_GFLEX.pdf).

Leia também `AGENTS.md` (regras obrigatórias do projeto).

---

## 0. Regras para quem for implementar

1. **O banco real NÃO bate com `supabase/migrations/`.** O banco tem 32 migrations aplicadas
   (última `20260908185148`). Arquivos como `20260624000000_security_hardening.sql` e
   `20260626000000_provas.sql` **não foram aplicados**: a tabela `turma_alunos` não existe e o
   bucket `justificativas` ainda está público. Antes de escrever SQL, inspecione o banco real com
   a ferramenta do Lovable `query_database` (projeto `21836077-d07e-4172-8863-efbe806e74c1`)
   usando apenas `SELECT`. Não dependa de nada que só existe nos arquivos.
2. **Não gastar créditos do Lovable.** Nunca usar `send_message`/`create_project` do Lovable.
   Ler arquivos, projeto e banco pelo MCP do Lovable não gasta créditos.
3. **Migrations:** escrever o arquivo em `supabase/migrations/AAAAMMDDHHMMSS_<nome>.sql`
   (aditivo, idempotente). Para aplicar no banco de produção, **mostrar o SQL e pedir confirmação
   ao usuário**; depois aplicar via `query_database` e registrar a versão em
   `supabase_migrations.schema_migrations (version, name)` para manter o histórico coerente.
4. **Não criar Edge Functions novas nesta fase.** Não há garantia de deploy sem o agente do
   Lovable. Tudo roda com RPCs `SECURITY DEFINER` + Storage + geração de PDF no navegador
   (jsPDF/jspdf-autotable, já instalados). Notificações = `INSERT` em `public.notificacoes`
   (já existe e tem coluna `user_id`).
5. **Git:** trabalhar no branch `claude/protocolos-f6-f7`. O Lovable sincroniza só o `main`;
   merge no `main` apenas com autorização do usuário.
6. Ao terminar cada etapa: `npm run build`, `npm test`, `npm run lint` sem erros novos.

### Estado real relevante (05/11/2026)

| Item | Situação |
|---|---|
| `app_role` | só `admin` |
| `auth.users` | 6 usuários (admins) |
| Professores / coordenadores / turmas | 48 / 3 / 20 |
| Cursos (`app_settings.data.cursos`) | `adm` Administração, `ped` Pedagogia, `dir` Direito |
| Alunos | **nenhum**. `exam_students` existe (id, turma_id, name, enrollment) e está vazia |
| `has_role(_user_id uuid, _role app_role)` | existe |
| `notificacoes` | id, destino_role, professor_id, user_id, tipo, titulo, mensagem, link, lida, created_at |
| Buckets | `justificativas` (público!), `provas-femaf`, `database_export_03_10_26` |

---

## 1. Produto: Central do Aluno (link próprio)

Uma área separada, com layout próprio e sem o menu do admin, para mandar o link aos alunos:

| Rota | Quem | Conteúdo |
|---|---|---|
| `/central` | público | Tela de entrada: Entrar, Primeiro acesso, Validar documento |
| `/central/primeiro-acesso` | público | Aluno cria a conta (seção 3) |
| `/central/protocolos` | aluno | Meus protocolos (lista + linha do tempo) |
| `/central/protocolos/novo` | aluno | Abrir protocolo (assistente) |
| `/central/protocolos/:id` | aluno | Detalhe, responder pendência, baixar documentos |
| `/central/documentos` | aluno | Pasta digital: comprovantes, pareceres, extratos |
| `/central/equipe` | equipe | Fila de trabalho de coordenação, secretaria e setores |
| `/central/equipe/protocolos/:id` | equipe | Análise e tramitação |
| `/central/assinaturas` | equipe | Documentos aguardando a minha assinatura |
| `/validar` e `/validar/:codigo` | público | Validação de documento por código/QR |

Link para os alunos: `<domínio publicado>/central`. Mobile-first (360px sem rolagem
horizontal), barra inferior no celular: Protocolos · Novo · Documentos · Perfil.
No admin (`/admin`), adicionar o grupo "Secretaria" com: Protocolos (mesma fila, visão total),
Alunos (cadastro/importação), Equipe e setores, Tipos de protocolo, Documentos emitidos,
e a página de Links (copiar link + QR de `/central` e `/validar`).

---

## 2. Os 6 fluxos (do PROTOCOLOS_GFLEX.pdf) como configuração

Os fluxos ficam em **dados** (`protocolo_tipos.etapas`), não em `if` espalhado no código.
Ações possíveis em qualquer etapa: `deferir`, `indeferir` (parecer obrigatório),
`solicitar_complementacao` (vai para "aguardando aluno"; quando o aluno responde, volta para a
mesma etapa), `encaminhar` (só onde indicado), `comentar` (interno ou visível ao aluno).

### 2.1 Segunda chamada — `segunda_chamada`
- **Anexo obrigatório:** comprovante do impedimento (atestado, declaração de trabalho, certidão).
- **Campos:** disciplina (das matérias da turma do aluno), professor (preenchido pela grade),
  data da avaliação perdida, avaliação (AV1/AV2/Final), motivo.
- **Tempestividade:** prazo regimental configurável (padrão 3 dias úteis após a data da prova,
  usando `is_dia_letivo` / calendário). Fora do prazo o sistema **permite abrir**, mas marca
  "fora do prazo" para a coordenação decidir.
- **Etapas:**
  1. Coordenação do curso — analisa cabimento, prazo e anexo. Indeferir → encerra e notifica com
     o parecer. Deferir → Secretaria.
  2. Secretaria — informa taxa (valor opcional + anexo/link do boleto, se aplicável), **data,
     horário e local da 2ª chamada**, marca "aluno habilitado". Notifica aluno **e o professor da
     disciplina**.
  3. Concluído e arquivado (gera o documento "Deferimento de 2ª chamada").

### 2.2 Depósito de projeto de TCC — `tcc_projeto`
- **Anexos obrigatórios:** projeto (PDF/DOC/DOCX) + termo de aceite do orientador (PDF).
- **Campos:** título, orientador (professor), coorientador (opcional), linha de pesquisa.
- **Etapas:**
  1. Coordenação / Comissão de TCC — registra recebimento, valida vínculo com orientador, aceite
     formal.
  2. Secretaria — registra no prontuário do aluno, copia para a pasta digital, encerra.
- Ao concluir: registro em `aluno_tcc` (situação `projeto_aceito`) + documento "Termo de aceite
  do projeto".

### 2.3 Depósito final do TCC — `tcc_final`
- **Anexos obrigatórios:** versão final (PDF) + parecer da banca/aprovação do orientador +
  declaração de antiplágio/nada consta.
- **Campos:** título final, orientador, data da defesa, membros da banca, nota final.
- **Etapas:**
  1. Coordenação — valida conformidade, **homologa a nota final** (campo obrigatório na ação).
  2. Secretaria — atualiza o prontuário/histórico, arquiva o trabalho, encerra.
- Ao concluir: `aluno_tcc` → `concluido` com nota homologada + documento "Homologação do TCC".

### 2.4 Abono ou justificativa de faltas — `abono_faltas`
- **Anexo obrigatório:** documento oficial (atestado com CID, declaração das Forças Armadas,
  convocação judicial etc.).
- **Campos:** tipo de documento, período (data inicial e final), disciplinas afetadas (múltipla
  escolha; o sistema sugere as aulas da grade da turma no período), observação.
- **Etapas:**
  1. Coordenação — analisa enquadramento. Indeferir → justificativa + notifica. Deferir →
     **notifica cada professor das disciplinas afetadas** (via `horarios_aula`/`turma_materias`
     → `notificacoes.professor_id`) com aluno, período e orientação de abono/compensação.
  2. Concluído pela própria coordenação; decisão arquivada na pasta do aluno.
- O CID é dado sensível (LGPD): o anexo só é visível para a coordenação do curso e a secretaria;
  o professor recebe apenas "falta abonada no período X", nunca o atestado.

### 2.5 Atividades complementares — `atividades_complementares`
- **Anexos obrigatórios:** um certificado por atividade (carga horária, data e emissor/CNPJ
  visíveis).
- **Campos:** lista de itens (descrição, emissor, CNPJ, data, carga horária declarada,
  categoria sugerida) — um anexo por item.
- **Etapas:**
  1. Coordenação — por item: autêntico? categoria (tabela `ac_categorias` com limite de horas por
     categoria) e **horas deferidas** (≤ declarada, respeitando o limite da categoria).
  2. Lançamento automático em `aluno_horas_complementares`, geração do **extrato de horas** em
     PDF, notificação e encerramento.

### 2.6 Protocolo geral — `geral`
- **Anexo:** pelo menos um (requerimento fundamentado e/ou comprovantes).
- **Campos:** assunto, descrição.
- **Etapas:**
  1. Secretaria (triagem) — confere anexos e **encaminha** para o setor: Financeiro, Ouvidoria,
     NDE, Direção, Biblioteca, Coordenação do curso (lista em `setores`).
  2. Setor de destino — analisa, executa, registra parecer, notifica o aluno, conclui.

### Status do protocolo
`aberto` → `em_analise` → (`aguardando_aluno` ↔ `em_analise`) → `deferido` | `indeferido` →
`concluido`. Também `cancelado` (pelo aluno, só enquanto `aberto`).

---

## 3. Identidade mínima (recorte da F0 necessário para F6/F7)

1. `ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS` para `aluno`, `secretaria`,
   `coordenador`, `diretor`, `setor` (migration própria, porque `ADD VALUE` não pode ser usado na
   mesma transação em que é referenciado).
2. Tabela `alunos` (base da F2, só o necessário agora): id, user_id UNIQUE NULL, matricula
   UNIQUE, nome, cpf UNIQUE (só dígitos), data_nascimento, email, telefone, curso_id text,
   turma_id uuid NULL → turmas, situacao (ativo, trancado, formado, cancelado), created_at,
   updated_at.
3. **Importação pela secretaria** em `/admin/alunos`: CSV/XLSX (`xlsx-js-style` já instalado)
   com matrícula, nome, CPF, data de nascimento, e-mail, curso, turma; pré-visualização,
   validação de CPF e relatório de duplicados. Cadastro manual também.
4. **Primeiro acesso do aluno** (sem Edge Function): o aluno informa matrícula + CPF + data de
   nascimento + e-mail + senha. O cliente chama `supabase.auth.signUp`; em seguida a RPC
   `aluno_vincular_conta(p_matricula, p_cpf, p_nascimento)` liga `alunos.user_id = auth.uid()`
   se os três dados baterem e o aluno ainda não tiver conta, e grava o papel `aluno` em
   `user_roles`. Limite de 5 tentativas por matrícula a cada 15 min (`acesso_tentativas`).
   Mensagem de erro genérica. **Verificar** nas configurações de Auth do projeto se a confirmação
   de e-mail está ligada e tratar os dois casos na tela.
5. **Equipe:** coordenadores, secretaria, direção e setores entram com e-mail e senha. Cadastro:
   a pessoa cria a conta em `/central/equipe/cadastro`; o admin, em `/admin/equipe`, aprova
   atribuindo papel e setor (insert em `user_roles` e `setor_membros`, permitido ao admin por
   RLS). Vincular coordenador a `professores` com a nova coluna `professores.user_id`
   (nullable) para reaproveitar `coordenadores.cursos`.
6. `AuthContext` passa a expor `roles: AppRole[]`, `alunoId` e `hasRole()`. **Corrigir** o
   `signIn` atual, que faz `signOut` de quem não é admin: a checagem de admin fica só nas rotas
   `/admin`. `ProtectedRoute` ganha `roles={[...]}`.
7. Funções auxiliares (STABLE, SECURITY DEFINER, `SET search_path = public`):
   `has_any_role(_roles app_role[])`, `current_aluno_id()`, `coordena_curso(_curso text)`,
   `membro_setor(_setor text)`, `is_secretaria()` (secretaria ou admin).

---

## 4. Banco de dados — F7 (protocolos)

```
setores (id text PK: secretaria, coordenacao, comissao_tcc, financeiro, ouvidoria, nde, direcao, biblioteca;
         nome, ativo)
setor_membros (setor_id, user_id, curso_id text NULL)  -- curso_id para coordenação/comissão por curso
protocolo_tipos (id text PK, nome, descricao, instrucoes_aluno, campos jsonb, anexos jsonb,
                 etapas jsonb, prazo_regimental jsonb, prazo_resposta_dias_uteis int,
                 gera_documento text NULL, ativo, ordem)
protocolos (id uuid, numero text UNIQUE  -- 2026.000123, sequência por ano
            tipo_id, aluno_id, curso_id, turma_id, dados jsonb, status, etapa_atual int,
            setor_atual text, fora_do_prazo bool, prazo_resposta_em date,
            aberto_em, concluido_em, decisao (deferido|indeferido) NULL, parecer_final text,
            cancelado_em, updated_at)
protocolo_tramites (id, protocolo_id, etapa, setor_id, acao, parecer, dados jsonb,
                    visivel_aluno bool, user_id, created_at)        -- só INSERT, nunca UPDATE/DELETE
protocolo_anexos (id, protocolo_id, tramite_id NULL, tipo_anexo text, nome_arquivo,
                  storage_path, mime, tamanho, sha256, enviado_por, sensivel bool, created_at)
aluno_tcc (aluno_id, titulo, orientador_id, situacao, nota_final, protocolo_projeto_id,
           protocolo_final_id, homologado_em)
ac_categorias (id, nome, limite_horas, ativo)
aluno_horas_complementares (id, aluno_id, protocolo_id, categoria_id, descricao, emissor,
                            data_atividade, horas_declaradas, horas_deferidas, created_at)
acesso_tentativas (chave, tentativas, bloqueado_ate)
```

Formato de `etapas` (exemplo do `segunda_chamada`):
```json
[
  {"ordem":1,"setor":"coordenacao","acoes":["deferir","indeferir","solicitar_complementacao"],
   "ao_deferir":"proxima","ao_indeferir":"encerrar"},
  {"ordem":2,"setor":"secretaria","acoes":["concluir","solicitar_complementacao"],
   "campos_acao":["taxa_valor","boleto_anexo","data_prova","horario","local"],
   "ao_concluir":"encerrar","notificar":["aluno","professor_disciplina"]}
]
```
Os seis tipos entram por seed na migration, com `campos`, `anexos` (id, rótulo, obrigatório,
mimes aceitos, máx. 10 MB, múltiplo) e `etapas` conforme a seção 2.

### RPCs (todas SECURITY DEFINER, `SET search_path = public`, checagem de papel no início)
- `protocolo_abrir(p_tipo, p_dados jsonb, p_anexos jsonb)` — só aluno com conta vinculada; valida
  campos e anexos obrigatórios contra o tipo; calcula `fora_do_prazo`; gera `numero` com
  `pg_advisory_xact_lock` por ano; cria trâmite "abertura"; notifica membros do primeiro setor
  (coordenação do curso do aluno quando `setor = coordenacao`).
- `protocolo_tramitar(p_id, p_acao, p_parecer, p_dados jsonb, p_setor_destino)` — valida que o
  usuário é membro do setor da etapa atual (coordenação: `coordena_curso(curso_id)`), que a ação
  é permitida na etapa e que o parecer existe quando obrigatório; avança/encerra; aplica efeitos
  (TCC, horas complementares, notificação a professores); grava o trâmite e registra a ação na nova tabela
  `academico_audit_logs` (user_id, acao, entidade, entidade_id, old_data, new_data).
- `protocolo_responder_pendencia(p_id, p_texto, p_anexos)` — aluno, só em `aguardando_aluno`.
- `protocolo_cancelar(p_id, p_motivo)` — aluno, só em `aberto`.
- `protocolos_fila(p_filtros jsonb)` — equipe: só o que está no seu setor/curso; secretaria e
  admin veem tudo.
- `protocolo_detalhe(p_id)` — devolve protocolo + trâmites + anexos respeitando visibilidade
  (aluno não vê trâmites internos; professor nunca vê anexos sensíveis).

### RLS
Todas as tabelas com RLS ligado; leitura direta só onde for simples (aluno lê os próprios
protocolos; equipe lê via RPC). Escrita **somente** pelas RPCs (sem policies de
INSERT/UPDATE para `authenticated`). `REVOKE EXECUTE ... FROM PUBLIC, anon` e `GRANT` só para
`authenticated` em cada função; funções de validação pública (`documento_validar`) com
`GRANT ... TO anon`.

### Storage
Bucket privado `protocolos`, caminho `{aluno_id}/{protocolo_id}/{uuid}-{arquivo}`. Policies:
aluno faz upload só na própria pasta; leitura por URL assinada (60 s) gerada pelo cliente depois
que `protocolo_detalhe` confirma o acesso — policy de SELECT usando uma função
`pode_ver_anexo(name)`. Validar tipo e tamanho no cliente e na policy.

---

## 5. Banco de dados e fluxo — F6 (documentos e assinatura)

```
documento_modelos (id text PK, nome, tipo, signatarios jsonb, layout jsonb, ativo)
documentos (id uuid, codigo text UNIQUE,  -- IPD-XXXX-XXXX, alfabeto sem 0/O/1/I, dígito verificador
            modelo_id, titulo, aluno_id NULL, protocolo_id NULL, snapshot jsonb,
            storage_path NULL, sha256 NULL, status (aguardando_assinatura|assinado|cancelado),
            emitido_por, emitido_em, cancelado_por, cancelado_motivo)
documento_assinaturas (id, documento_id, ordem, papel, signatario_user_id NULL,
                       status (pendente|assinado|recusado), assinado_em, ip_informado,
                       user_agent, sha256_snapshot, motivo_recusa)
```
Bucket privado `documentos`, caminho `{documento_id}.pdf`.

### Documentos gerados nesta fase
| Modelo | Quando | Assinam |
|---|---|---|
| Comprovante de protocolo | na abertura | aluno (aceite eletrônico ao protocolar) |
| Parecer/decisão do protocolo | ao deferir/indeferir | quem decidiu (coordenador ou setor) |
| Deferimento de 2ª chamada | fim do fluxo 2.1 | coordenador + secretaria |
| Termo de aceite do projeto de TCC | fim do 2.2 | coordenador + secretaria |
| Homologação do TCC | fim do 2.3 | coordenador + secretaria |
| Extrato de horas complementares | fim do 2.5 | coordenador |
| Declaração genérica (texto livre da secretaria) | manual, em `/admin/documentos` | secretaria + direção |

### Fluxo técnico (sem Edge Function)
1. `documento_criar(p_modelo, p_protocolo, p_dados)` (RPC) — monta o `snapshot` no servidor a
   partir do banco (nome, matrícula, curso, número do protocolo, decisão…), gera `codigo`, cria
   as assinaturas pendentes conforme o modelo. Chamada automaticamente pelos efeitos de
   `protocolo_tramitar`.
2. `documento_assinar(p_id, p_user_agent)` (RPC) — confere se é a vez do usuário (ordem e papel),
   grava a assinatura com `now()` e o hash do snapshot. **Antes** de chamar, o cliente pede a
   senha de novo e confirma com `supabase.auth.signInWithPassword` (reautenticação) — é o que
   caracteriza a assinatura eletrônica avançada (Lei 14.063/2020). Quando a última assinatura é
   feita, status → `assinado`.
3. Renderização: `src/features/documentos/lib/renderPdf.ts` — função **pura e determinística**
   `(snapshot, assinaturas, codigo) → PDF` com jsPDF: A4, logo FEMAF (`src/assets/logo-femaf.png`),
   cabeçalho institucional, corpo do modelo, bloco de assinaturas (nome, cargo, data/hora,
   "assinado eletronicamente"), rodapé com código + QR Code (adicionar a dependência `qrcode`)
   apontando para `<origem>/validar/<codigo>`, página "Manifesto de assinaturas" quando assinado.
4. Ao completar as assinaturas, o cliente de quem assinou por último gera o PDF, calcula
   SHA-256 (WebCrypto), envia para `documentos/{id}.pdf` e chama
   `documento_registrar_arquivo(p_id, p_sha256)` (RPC, só uma vez; depois imutável).
5. `documento_validar(p_codigo)` (RPC pública, `anon`) — devolve tipo, título, titular com nome
   mascarado ("Maria S*** O***"), matrícula parcial, data, signatários (nome, cargo, data/hora),
   status e sha256. Limite simples por código (registrar consultas).
6. `/validar/:codigo` — mostra o resultado com selo "Documento autêntico" ou "Cancelado/Não
   encontrado" e permite **enviar o PDF** para comparar o SHA-256 no navegador.

---

## 6. Telas (src/features/protocolos e src/features/documentos)

```
src/features/
  protocolos/
    api/        useProtocolos.ts, useProtocoloDetalhe.ts, useFila.ts, mutations.ts, uploads.ts
    components/ TipoCard, FormularioDinamico, AnexosUploader, LinhaDoTempo, StatusBadge,
                PrazoBadge, AcaoTramite (dialog com campos da etapa), ItensAtividadeComplementar
    pages/      CentralHome, PrimeiroAcesso, MeusProtocolos, NovoProtocolo, ProtocoloAluno,
                FilaEquipe, ProtocoloEquipe, AdminTipos, AdminAlunos, AdminEquipe, Links
    lib/        validarDados.ts, prazos.ts (dias úteis), numeroProtocolo.ts, cpf.ts, horasAC.ts
    layouts/    CentralLayout.tsx
  documentos/
    api/        useDocumentos.ts, useAssinaturas.ts
    components/ VisualizadorPdf (pdfjs-dist já instalado), DialogAssinar
    pages/      MeusDocumentos, Assinaturas, Validar, AdminDocumentos
    lib/        renderPdf.ts, codigo.ts, sha256.ts, mascarar.ts
```

- **Novo protocolo (aluno):** 1) escolher o tipo (cards com nome, descrição curta e lista de
  anexos exigidos) → 2) formulário dinâmico do tipo → 3) anexos com upload e barra de progresso
  → 4) revisão + aceite "Declaro que as informações são verdadeiras" → enviar → tela de sucesso
  com número do protocolo e botão do comprovante PDF. Rascunho salvo em `localStorage`.
- **Meus protocolos:** lista com número, tipo, status (badge), etapa atual, data; detalhe com
  linha do tempo (só trâmites visíveis), pendências para responder, documentos gerados.
- **Fila da equipe:** abas "Minha etapa", "Aguardando aluno", "Concluídos"; filtros por tipo,
  curso, prazo; badge de prazo vencido e "fora do prazo regimental"; contadores no topo.
- **Análise:** dados do aluno, campos do pedido, anexos com visualizador, histórico completo,
  botões só das ações permitidas na etapa; cada ação abre diálogo com os campos exigidos
  (parecer, nota homologada, horas por item, setor de destino, data da 2ª chamada…).
- Componentes de UI existentes (`src/components/ui`), tokens de `src/index.css`, estados de
  carregamento (`ListSkeleton`), vazio e erro em português.

---

## 7. Testes obrigatórios (Vitest)
- `numeroProtocolo`, `codigo` (dígito verificador, sem caracteres ambíguos), `cpf`,
  `prazos` (dias úteis com feriados), `validarDados` (campos e anexos obrigatórios por tipo),
  `horasAC` (limite por categoria), `mascarar`, e `renderPdf` (gera sem erro e é determinístico
  para o mesmo snapshot).
- Roteiro SQL de verificação (rodar só `SELECT`/transação com `ROLLBACK` em produção):
  aluno A não lê protocolo do aluno B; coordenador de `ped` não vê protocolo de `dir`; `anon`
  não executa nenhuma RPC além de `documento_validar`.

## 8. Ordem de execução
1. Migration A: enum `app_role` (sozinha).
2. Migration B: alunos, setores, funções auxiliares, `professores.user_id`, tentativas.
3. Migration C: protocolos + seed dos 6 tipos + `ac_categorias` + bucket `protocolos`.
4. Migration D: documentos + bucket `documentos` + RPCs de assinatura/validação.
5. Front: AuthContext/ProtectedRoute → Central (aluno) → Fila da equipe → Documentos →
   Validação → Admin (alunos, equipe, tipos, links).
6. Testes, build, lint, atualizar `roadmap.md`.
7. Relatório final: o que foi feito, SQL aplicado, como testar, link `/central` para os alunos.

## 9. Fora do escopo agora
Boletos integrados (a taxa da 2ª chamada é valor + anexo/link manual), diário de notas
(a homologação de nota do TCC fica em `aluno_tcc`), certificado ICP-Brasil e diploma digital.
