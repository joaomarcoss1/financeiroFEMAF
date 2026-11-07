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
- 22 professores (Pedagogia e Psicologia) vinculados às suas disciplinas — falta completar CPF, PIX, e‑mail e valor da hora‑aula.
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
