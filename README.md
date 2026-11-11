# Plataforma de Gestão Financeira FEMAF

Sistema da **FEMAF – Faculdade de Educação Memorial Adelaide Franco** (Pedreiras‑MA) para
ponto docente e administrativo, folha de pagamento, grade de horários, relatórios, provas,
permutas e Secretaria Acadêmica (protocolos, documentos com validação por QR Code).

Stack: React + Vite + TypeScript + Tailwind/shadcn, Supabase (Postgres, Auth, Storage, Edge Functions), deploy na Vercel.

## Identidade visual

Paleta extraída da logo oficial (`src/assets/logo-femaf.png`):

| Token | Cor | Uso |
|---|---|---|
| Índigo FEMAF | `#1E1180` (`246 76% 28%`) | cor primária, barras e botões |
| Azul royal | `#0A78D8` (`208 91% 44%`) | degradês, anel de foco |
| Azul‑céu | `#0095E8` (`201 100% 46%`) | destaques e fios de acento |
| Marinho | `#12106A` | fundos escuros |

Os tokens ficam em `src/index.css`; o símbolo vetorial do livro aberto está em `src/components/MarcaFemaf.tsx`.

## Banco de dados (Supabase `witmbqswbhpmngmnigly`)

Opção A — SQL Editor (mais simples): abra o projeto no Supabase → **SQL Editor** → cole e rode
`supabase/femaf_banco_completo.sql`. Ele cria todo o schema e já cadastra os dados de 2026.2.

Opção B — CLI:

```bash
npx supabase link --project-ref witmbqswbhpmngmnigly
```

```bash
npx supabase db push
```

```bash
npx supabase functions deploy
```

### Dados já cadastrados (migração `20261107120000_dados_femaf_2026_2.sql`)

- Cursos: Engenharia Civil (`eng`), Pedagogia (`ped`), Psicologia (`psi`).
- 12 turmas (noturno): ENG 2º/4º/6º, PED 2º/4º/6º/8º, PSI 2º/4º/6º/8º/10º.
- 67 disciplinas com carga horária, vinculadas às turmas.
- 31 professores vinculados às suas disciplinas (Engenharia Civil já com valor da hora‑aula por titulação).
- Grade semanal fixa (1º ao 4º horário) de cada disciplina com dia definido no horário.
- Feriados nacionais de 2026.2.

### Primeiro administrador

1. Supabase → **Authentication → Users → Add user** (e‑mail e senha).
2. No SQL Editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'SEU-EMAIL@femaf.edu.br';
```

Depois disso, novos administradores podem ser criados pela tela **Configurações**.

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha a chave **anon/publishable** do projeto
(Supabase → Project Settings → API). As mesmas variáveis precisam estar na Vercel.

## Desenvolvimento

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

## Configuração do projeto Supabase (já aplicada em produção)

- **Edge Functions** instaladas: `registrar-ponto`, `aprovar-registro`, `check-faltas`, `coord-anexo-url`, `create-admin`, `prova-checklist`, `prova-enviar`, `prova-gerar`, `send-push`, `vapid-public-key`.
- **Segredos das funções**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (notificações push) e `CRON_SECRET` (agendamento).
- **Agendamento** `femaf-check-faltas` (pg_cron, a cada 5 min) chama `check-faltas` com o cabeçalho `x-cron-secret`, lido do Vault (`check_faltas_secret`). Avisa o professor 10 min após o início da aula sem ponto e a administração ao fim da aula.
- **Auth**: Site URL `https://financeiro-femaf.vercel.app` e redirecionamentos permitidos para o domínio de produção e as prévias da Vercel.
