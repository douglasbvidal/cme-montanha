# Como contribuir

Obrigado pelo interesse em melhorar o site do CME Montanha.

## Perguntas, sugestões e correções

- **Dúvidas ou sugestões de interesse geral:** use as Discussões do repositório. Elas são **públicas**.
- **Erro técnico no site** (link quebrado, problema de acessibilidade, página que não abre): abra uma Issue descrevendo a página e o problema, sem dados pessoais.
- **Dado pessoal em documento** (pedido de correção ou retirada), **pedido formal de informação (LAI)** ou **assunto reservado**: **nunca** pelo GitHub. Use os canais da página “Fale com o CME” do site (contato institucional, SIC/LAI da Prefeitura ou protocolo oficial).
- Assuntos que envolvam estudantes, famílias ou servidores identificados nunca devem ser tratados no repositório.

## Alterações no código

1. Mantenha o site sem dependências: HTML, CSS e JavaScript puro, sem CDN, sem fontes externas, sem rastreadores, sem npm.
2. Use somente caminhos relativos (o site roda em subpasta no GitHub Pages).
3. Cabeçalho, menu, rodapé e textos fixos ficam em `tools/gerar_paginas.py`; rode o script depois de editar. Não edite o HTML gerado: `checar_links.py` acusa páginas diferentes do molde.
4. Não escreva fatos institucionais (nomes, números, datas, endereços, contatos) no código: eles vêm de `data/*.json` e `site.config.json`, com fonte.
5. Campos novos de dados devem ser **opcionais**: o site precisa funcionar se o campo faltar.
6. Antes de propor a mudança, rode as ferramentas na ordem do `GUIA_MANUTENCAO.md` e confira `0 erro(s)` em `python tools/checar_links.py --hash`; teste com teclado, em tela estreita (375 px) e no tema escuro. Para testar sem dados reais: `python tools/preparar_amostra.py`.

## Documentos

Somente a secretaria do Conselho publica documentos, seguindo o `GUIA_MANUTENCAO.md` e os critérios do `GOVERNANCA.md`. Cada PDF hospedado precisa ter passado pela triagem de publicidade e ter o `sha256` registrado em `data/documentos.json`. O documento oficial assinado ou publicado no Diário Oficial prevalece sobre o conteúdo do site.
