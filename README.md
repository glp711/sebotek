# Sebo Virtual

MVP do TCC para busca agregada de livros em sebos independentes, usando React, TypeScript e Supabase.

## Funcionalidades atuais

- Catalogo publico com busca por titulo, autor, categoria, ISBN e sebo.
- Cards de livros clicaveis com capa, resumo, preco, estado, estoque e contato por WhatsApp.
- Filtros por categoria e estado do livro, com ordenacao por preco, titulo ou recentes.
- Pagina de sebos parceiros com status de verificacao, localizacao, telefone e resumo do acervo.
- Area do sebo com login, cadastro do sebo para aprovacao e cadastro de livros.

## Arquitetura

- React + Vite no frontend.
- Supabase Auth para cliente e responsavel pelo sebo.
- Supabase Postgres com RLS para catalogo, sebos, wishlist e avaliacoes.
- Supabase Storage para capas dos livros e fotos dos sebos.
- Node/Express fica opcional para uma fase futura, caso o projeto precise de jobs, notificacoes ou regras administrativas mais sensiveis.

## Rodar local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local`. Nunca coloque chave `service_role` ou `sb_secret_...` no frontend.

Sem `.env.local`, o app abre em modo demonstracao com dados ficticios.

## Banco

A migration principal esta em `supabase/migrations/20260614203809_initial_supabase_architecture.sql`.

Ela cria uma arquitetura Supabase-native com:

- `profiles`
- `stores`
- `books`
- `reviews`
- `wishlists`
- `wishlist_matches`
- buckets `book-covers` e `store-photos`
- RLS em todas as tabelas publicas
- politicas para leitura publica do catalogo aprovado e escrita restrita por usuario/sebo

## Comandos uteis

```bash
npm run build
npm run lint
npx supabase migration list
```
