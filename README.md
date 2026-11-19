# Site público do CME Montanha

Portal estático de consulta aos atos, reuniões e documentos públicos do Conselho Municipal de Educação de Montanha (ES), hospedado no GitHub Pages.

- HTML5 + CSS + JavaScript puro, sem framework, sem build, sem CDN, sem fontes externas, sem cookies e sem rastreadores.
- Somente caminhos relativos: funciona em `https://<conta>.github.io/cme-montanha/`, em domínio próprio e em servidor local.
- Os fatos institucionais vêm **apenas** de `data/*.json` e `site.config.json`. Os textos fixos das páginas só explicam como usar o site.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html`, `*/index.html`, `404.html` | Páginas (geradas por `tools/gerar_paginas.py`, versionadas) |
| `assets/css/site.css` | Estilos (tokens de cor em `:root`, tema escuro, impressão) |
| `assets/js/` | `comum.js` (utilidades, tema, menu, dados), `busca.js`, `documentos.js`, `reunioes.js`, `paginas.js` |
| `data/documentos.json` | Índice de documentos (esquema abaixo) |
| `data/reunioes.json`, `data/conselheiros.json`, `data/conteudo.json` | Reuniões, composição e textos institucionais com fonte |
| `docs/<categoria>/*.pdf` | PDFs hospedados (somente atos do próprio CME) |
| `calendario.ics` | Calendário de reuniões (iCalendar) |
| `site.config.json` | E-mail público, endereço, telefone público, repositório, URL do site, mural (giscus) |
| `tools/` | Scripts de manutenção (não são publicados) |

### Esquema de `data/documentos.json`

Lista de objetos: `id`, `categoria` (`legislacao`, `regimento`, `resolucoes`, `pareceres`, `oficios`, `pautas`, `atas`, `outros`), `titulo`, `numero`, `ano`, `data` (AAAA-MM-DD ou `null`), `emissor`, `assunto`, `arquivo` (`docs/...`), `tamanho_kb`, `paginas`, `status` (`vigente`, `assinado`, `enviado`, `em_estudo`, `referencia`), `fonte_original`, `sha256`, `observacao`.

Documentos de **outros órgãos** (leis, decretos, portarias) não são hospedados: use `"externo": true`, `"url": "https://..."` (link oficial) e `arquivo`, `sha256`, `tamanho_kb`, `paginas` como `null`. O site mostra “Abrir no site oficial ↗”.

## Como atualizar documentos

1. Faça a triagem de publicidade (somente atos públicos, aprovados/assinados/enviados; nada de dados pessoais desnecessários).
2. Converta para PDF, copie para `docs/<categoria>/` e atualize `data/documentos.json` com o script de índice usado pela secretaria (mantido fora do repositório público). Cada item precisa de `sha256` do PDF publicado.
3. Atualize `data/reunioes.json` e `calendario.ics` quando houver reunião nova.
4. Confira tudo:
   ```
   python tools/checar_links.py --hash
   ```
   O resultado deve terminar com `0 erro(s)`.
5. Se mudou `url_site` ou criou página nova: `python tools/gerar_sitemap.py`.
6. Se mudou cabeçalho, menu, rodapé ou textos fixos: edite `tools/gerar_paginas.py` e rode `python tools/gerar_paginas.py` (não edite o HTML à mão, ele será sobrescrito).

## Testar localmente

```
python -m http.server 8765
```
e abra `http://127.0.0.1:8765/`. Aberto direto do disco (`file://`), o navegador bloqueia a leitura dos JSON: as páginas mostram um aviso e continuam navegáveis.

Para testar com dados fictícios: `python tools/preparar_amostra.py` e depois `python -m http.server 8765 --directory _amostra` (a pasta `_amostra/` não vai para o repositório).

## Publicar (GitHub Pages)

1. Repositório público (ex.: `cme-montanha`) com este conteúdo na branch `main`.
2. Em **Settings → Pages → Source**, escolha **GitHub Actions**.
3. A cada `push` na `main`, `.github/workflows/pages.yml` publica a raiz, exceto `_amostra/`, `_relatorios/`, `tools/`, `.github/`, `data/pendencias.json` e `data/manifesto.csv`.
4. Preencha `site.config.json` (`url_site`, `repositorio`, e-mail público quando definido).

**Atenção:** tudo o que estiver no repositório público é público, mesmo que não apareça no site. Não versione arquivos internos (ver `.gitignore`).

## Mural (opcional)

O mural usa as Discussões do GitHub. A incorporação via giscus fica **desativada** por padrão; para ativar, habilite Discussions no repositório, instale o app giscus e preencha `giscus` em `site.config.json` (`ativo: true`, `repo`, `repo_id`, `categoria`, `categoria_id`). Sem essa configuração, nenhum script de terceiros é carregado.

## Licença

Ver `LICENSE`: documentos são atos públicos oficiais; o código do site está sob licença MIT.
