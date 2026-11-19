# Como contribuir

Obrigado pelo interesse em melhorar o site do CME Montanha.

## Perguntas, sugestões e correções

- **Dúvidas ou sugestões de interesse geral:** use as Discussões do repositório (são públicas).
- **Erro no site** (link quebrado, problema de acessibilidade, informação desatualizada): abra uma Issue descrevendo a página e o problema.
- **Dado pessoal em documento** (pedido de correção ou retirada): **não** abra Issue pública. Use a página “Fale com o CME” do site.
- Assuntos reservados ou que envolvam estudantes, famílias ou servidores identificados nunca devem ser tratados no repositório.

## Alterações no código

1. Mantenha o site sem dependências: HTML, CSS e JavaScript puro, sem CDN, sem fontes externas, sem rastreadores.
2. Use somente caminhos relativos (o site roda em subpasta no GitHub Pages).
3. Cabeçalho, menu, rodapé e textos fixos ficam em `tools/gerar_paginas.py`; rode o script depois de editar.
4. Não escreva fatos institucionais (nomes, números, datas, endereços, contatos) no código: eles vêm de `data/*.json` e `site.config.json`, com fonte.
5. Antes de propor a mudança, rode `python tools/checar_links.py --hash` e confira que não há erros; teste com teclado, em tela estreita (375 px) e no tema escuro.

## Documentos

Somente a secretaria do Conselho publica documentos. Cada documento precisa ter passado pela triagem de publicidade e ter o `sha256` do PDF publicado registrado em `data/documentos.json`. O documento oficial assinado prevalece sobre o conteúdo do site.
