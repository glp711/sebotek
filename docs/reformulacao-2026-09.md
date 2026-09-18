# Reformulacao do Sebo Virtual - setembro de 2026

## Experiencia

O catalogo agora e a primeira experiencia do site. A interface clara utiliza capas reais, indicadores de conservacao, preco, identificacao do sebo e acesso direto aos detalhes. A cabecalho oferece busca e acesso a conta. A navegacao possui enderecos separados para catalogo, sebos, cliente, lojista e administracao, com suporte a recarregar, voltar e avancar no navegador.

A busca aceita palavras sem acento e fora da ordem do titulo. Os filtros de categoria, conservacao, estabelecimento e preco maximo podem ser combinados. O usuario pode ordenar resultados, alternar grade/lista, remover filtros e salvar livros nos desejos de sua conta.

No cadastro, o usuario confirma a senha e pode exibi-la temporariamente. As paginas de retorno de email distinguem link invalido de acesso reconhecido. A recuperacao sem sessao valida nao habilita a troca de senha. Nenhum email real foi disparado nos testes desta reformulacao.

O lojista acompanha quatro etapas: conta, cadastro do sebo, analise e acervo. A criacao de produtos continua bloqueada ate a aprovacao. O editor oferece sugestoes de categorias e a edicao de um livro leva ao formulario. O administrador mantem os filtros de pendentes e aprovados e as acoes de aprovar ou retornar para analise.

## Acessibilidade

Foram mantidos o VLibras, os rotulos dos formularios e os controles nativos. Foram adicionados link para pular ao conteudo, pagina ativa anunciada, estados de selecao nos controles, foco visivel, fechamento dos detalhes com Escape e retencao/restauracao do foco no dialogo. O carregamento do VLibras nao bloqueia mais o HTML inicial. A integracao de um widget nao equivale a uma certificacao de acessibilidade.

## Supabase

Na retomada, o projeto estava INACTIVE e o endereco da API nao resolvia. A reativacao foi solicitada e o estado voltou a ACTIVE_HEALTHY. Uma consulta de leitura confirmou os dados existentes: 11 livros, 5 sebos (4 aprovados) e 4 perfis. Esses numeros sao um retrato da verificacao, nao valores fixos do sistema.

O catalogo consulta apenas livros de sebos aprovados e com estoque positivo. A lista de sebos tem consulta propria para incluir estabelecimentos aprovados sem acervo. O cliente carrega ate 1.000 livros; paginacao no servidor e uma evolucao necessaria para acervos maiores. As regras de autorizacao e tabelas existentes foram preservadas; nao houve migracao de banco nesta entrega.

## Verificacao

- Testes de regras: busca sem acento, palavras combinadas, intersecao de filtros, preco zero, ordenacao sem alterar os dados originais e normalizacao do WhatsApp.
- Navegador com API real: catalogo, detalhes, Escape e foco, grade/lista, filtros, busca persistida, navegacao, refresh, validacao local do cadastro e redirecionamento dos desejos para login.
- Larguras verificadas: 320, 390, 768 e desktop.
- Paineis com API interceptada: bloqueio do sebo pendente, aprovacao administrativa, criacao/edicao/remocao de livro, salvamento de desejo e painel do lojista no celular.
- Os testes dos paineis verificam a interface e o contrato das requisicoes; nao substituem testes das politicas RLS com usuarios reais.

## Como demonstrar

1. Abrir o catalogo e buscar um titulo.
2. Combinar categoria e preco, depois limpar os filtros.
3. Alternar grade/lista e abrir um exemplar.
4. Abrir um sebo e ver apenas o acervo dele.
5. Entrar com uma conta previamente confirmada e salvar um livro nos desejos.
6. Mostrar as etapas do lojista e, com a conta administradora, a revisao de sebos.
7. Demonstrar o layout mobile e o botao VLibras.

O envio de emails continua dependente do provedor padrao do Supabase e dos limites configurados. A reformulacao nao configura SMTP nem altera esses limites.
