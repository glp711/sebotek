# Guia de uso - Sebo Virtual

Este guia explica como usar o Sebo Virtual como leitor, como responsavel por um sebo e como executar o projeto em ambiente local.

## Acesso ao sistema

- Site em producao: https://sebo-virtual.vercel.app/
- Repositorio: https://github.com/glp711/sebotek

O sistema e um MVP de TCC para centralizar catalogos de sebos independentes. A ideia principal e permitir que o leitor encontre livros usados em diferentes sebos e fale diretamente com o estabelecimento que possui o exemplar.

## Como usar como leitor

1. Acesse https://sebo-virtual.vercel.app/
2. Use a busca principal para procurar por titulo, autor, categoria, ISBN ou nome do sebo.
3. Use os filtros do catalogo:
   - Categoria: filtra por genero ou classificacao do livro.
   - Estado: filtra por conservacao do exemplar.
   - Ordenar: organiza por recentes, menor preco, maior preco ou titulo.
4. Clique em um card de livro para abrir os detalhes.
5. Confira capa, resumo, preco, estado, quantidade, ISBN, editora, ano e dados do sebo.
6. Clique em `Chamar no WhatsApp` para conversar com o sebo sobre disponibilidade, reserva ou retirada.

## Como ver os sebos parceiros

1. Clique em `Sebos` no menu superior.
2. Veja a lista de sebos cadastrados.
3. Cada card mostra:
   - Nome do sebo.
   - Status de verificacao.
   - Quantidade de titulos no acervo.
   - Quantidade total de exemplares.
   - Menor preco do acervo.
   - Endereco, cidade, telefone e horario.
4. Clique em `Ver acervo` para voltar ao catalogo filtrando pelos livros daquele sebo.

## Como usar a area do sebo

1. Clique em `Meu sebo`.
2. Escolha `Entrar` ou `Cadastrar`.
3. Para criar uma conta, informe:
   - Nome do responsavel.
   - Email.
   - Senha com no minimo 6 caracteres.
4. Depois do login, cadastre os dados do sebo:
   - Nome.
   - Descricao.
   - Cidade e UF.
   - Endereco.
   - CEP.
   - WhatsApp.
   - Horario de funcionamento.
5. Envie o cadastro para aprovacao.
6. Aguarde a analise administrativa. Antes da aprovacao, o painel mostra que o sebo esta em verificacao e bloqueia o cadastro de livros.
7. Depois da aprovacao, cadastre livros informando:
   - Titulo.
   - Autor.
   - ISBN.
   - Categoria.
   - Editora.
   - Ano de publicacao.
   - Link da capa.
   - Resumo ou observacoes do exemplar.
   - Estado de conservacao.
   - Preco.
   - Quantidade.
8. Use o painel `Meu acervo` para:
   - Ver total de titulos, exemplares, livros sem estoque e livros com capa.
   - Buscar livros do proprio sebo.
   - Editar dados de um livro ja cadastrado.
   - Remover um livro do acervo.

Livros so podem ser criados depois que o sebo for aprovado. Essa regra aparece na interface e tambem e protegida no banco por RLS.

## Como usar o painel administrativo

1. Entre com uma conta que tenha role `ADMIN` na tabela `profiles`.
2. Apos o login, clique em `Admin` no menu superior.
3. Use os filtros `Pendentes`, `Aprovados` e `Todos`.
4. Clique em `Aprovar` para liberar um sebo verificado.
5. Clique em `Voltar para analise` se um sebo precisar ser bloqueado novamente.

Somente contas com role `ADMIN` conseguem acessar a lista administrativa e alterar o status de aprovacao. O responsavel pelo sebo nao consegue aprovar o proprio cadastro.

## Login, confirmacao de email e recuperacao de senha

O Sebo Virtual possui dois fluxos de conta:

- `Cliente`: usado pelo leitor para manter perfil e wishlist.
- `Meu sebo`: usado pelo responsavel pelo sebo para cadastrar o estabelecimento e publicar livros.

Ao criar conta, o Supabase envia um email de confirmacao. O link volta para:

```text
https://sebo-virtual.vercel.app/auth/confirm
```

Ao pedir recuperacao de senha, o link volta para:

```text
https://sebo-virtual.vercel.app/auth/reset-password
```

O codigo tambem usa `VITE_AUTH_REDIRECT_ORIGIN=https://sebo-virtual.vercel.app` para impedir que emails de confirmacao e reset caiam em `localhost`.

Em desenvolvimento local, as URLs abaixo podem ficar liberadas apenas como apoio para teste manual:

```text
http://127.0.0.1:5174/auth/confirm
http://127.0.0.1:5174/auth/reset-password
http://localhost:5174/auth/confirm
http://localhost:5174/auth/reset-password
```

No painel do Supabase, configure em `Authentication > URL Configuration`:

- Site URL: `https://sebo-virtual.vercel.app`
- Redirect URLs principais:
  - `https://sebo-virtual.vercel.app/auth/confirm`
  - `https://sebo-virtual.vercel.app/auth/reset-password`
- Redirect URLs locais: opcionais, apenas para desenvolvimento.

Sem essas URLs liberadas, o Supabase pode bloquear o redirecionamento ou mandar o usuario para uma URL antiga, como `localhost`.

## Fluxo sugerido para demonstracao

1. Abrir o site em producao.
2. Mostrar a busca por `Marina`.
3. Abrir o card do livro e mostrar capa, resumo e WhatsApp.
4. Limpar filtros e ordenar por menor preco.
5. Entrar na aba `Sebos` e mostrar os cards dos sebos parceiros.
6. Clicar em `Ver acervo` em um sebo.
7. Abrir a aba `Meu sebo` e explicar o fluxo de cadastro, aprovacao e publicacao de livros.
8. Abrir o painel `Admin` com uma conta administradora e mostrar a analise dos cadastros.
9. Explicar que o backend usa Supabase com Auth, Postgres, RLS e Storage.

## Como rodar localmente

Requisitos:

- Node.js instalado.
- npm instalado.
- Conta/projeto no Supabase para usar dados reais.

Passos:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Depois, abra o endereco mostrado pelo Vite, normalmente:

```text
http://localhost:5174/
```

No Windows PowerShell, se `cp` nao estiver disponivel, use:

```powershell
Copy-Item .env.example .env.local
```

## Variaveis de ambiente

O arquivo `.env.local` deve conter:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
```

Nunca coloque no frontend:

- `sb_secret_...`
- `service_role`
- senhas privadas
- tokens administrativos

Somente a chave publishable/anon deve ser usada no Vite, pois qualquer variavel com prefixo `VITE_` pode ficar visivel no navegador.

## Banco de dados

As migrations ficam em:

```text
supabase/migrations/
```

Principais tabelas do modelo Supabase-native:

- `profiles`
- `stores`
- `books`
- `reviews`
- `wishlists`
- `wishlist_matches`

Tambem existem buckets de storage previstos para:

- `book-covers`
- `store-photos`

O modelo usa RLS para proteger escrita e permitir leitura publica do catalogo aprovado.

## Deploy na Vercel

O projeto ja esta configurado com `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Para fazer deploy manual:

```bash
npx vercel --prod
```

Na Vercel, configure as mesmas variaveis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Comandos uteis

```bash
npm run dev
npm run build
npm run lint
```

## Melhorias futuras

- Historico de aprovacao com motivo de reprova.
- Upload de capas pelo painel do sebo.
- Upload de capas direto para o bucket `book-covers`.
- Notificacao automatica quando um livro desejado aparecer na wishlist.
- Reserva de exemplar.
- Avaliacoes de sebos.
- Mapa com sebos proximos.
- Historico de contato/reserva para o leitor.
