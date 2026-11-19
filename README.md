# Site público do CME Montanha

Portal estático de consulta aos atos, reuniões e documentos públicos do Conselho Municipal de Educação de Montanha (ES), hospedado no GitHub Pages.

- HTML5 + CSS + JavaScript puro, sem framework, sem build, sem CDN, sem fontes externas, sem cookies próprios e sem rastreadores.
- Somente caminhos relativos: funciona em `https://<conta>.github.io/cme-montanha/`, em domínio próprio e em servidor local.
- Os fatos institucionais vêm **apenas** de `data/*.json` e `site.config.json`. Os textos fixos das páginas só explicam como usar o site.
- O site é repositório de **consulta**: não substitui o Diário Oficial, o protocolo nem o documento assinado.

Documentos de apoio: [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) (passo a passo da secretaria), [`GOVERNANCA.md`](GOVERNANCA.md) (aprovação, publicidade, backup, sucessão) e [`CONTRIBUINDO.md`](CONTRIBUINDO.md).

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html`, `*/index.html`, `404.html` | Páginas (geradas por `tools/gerar_paginas.py`, versionadas — não edite à mão) |
| `assets/css/site.css` | Estilos (tokens de cor em `:root`, tema escuro, impressão) |
| `assets/js/` | `comum.js` (utilidades, vocabulários, tema, menu, dados), `busca.js`, `documentos.js`, `reunioes.js`, `paginas.js` |
| `data/documentos.json` | Índice de documentos (esquema abaixo) |
| `data/reunioes.json` | Reuniões |
| `data/conselheiros.json`, `data/conteudo.json` | Composição e textos institucionais com fonte |
| `data/atualizacao.json` | Data da última mudança real de cada conjunto (gerado por `tools/registrar_atualizacao.py`) |
| `docs/<categoria>/*.pdf` | PDFs hospedados (somente atos do próprio CME) |
| `calendario.ics` | Calendário de reuniões (gerado por `tools/gerar_ics.py`) |
| `site.config.json` | E-mail público, endereço, telefone público, repositório, URL do site, mural (giscus) |
| `tools/` | Ferramentas de manutenção e modelos (`tools/modelos/`) |

Pastas internas **não versionadas** (ver `.gitignore`): `_relatorios/`, `_revisao/`, `_amostra/`.

## Esquema dos dados

### `data/documentos.json` (lista)

Obrigatórios: `id` (único), `categoria`, `titulo`, `data` (AAAA-MM-DD ou `null`), `status`, e para PDF hospedado `arquivo` (`docs/...`) e `sha256`.

- `categoria`: `legislacao`, `regimento`, `resolucoes`, `pareceres`, `oficios`, `pautas`, `convocacoes`, `atas`, `boletins` (boletins e relatórios — art. 21 da Lei 1.166/2024), `outros`.
- `status` (antigo, continua valendo como alternativa): `vigente`, `assinado`, `enviado`, `em_estudo`, `referencia`.
- Outros campos: `numero`, `ano`, `emissor`, `assunto`, `tamanho_kb`, `paginas`, `fonte_original`, `observacao`.
- Documento de **outro órgão**: `"externo": true`, `"url": "https://..."` e `arquivo`/`sha256` nulos. O site mostra “Abrir no site oficial ↗”.

Campos opcionais (o site mostra só quando existem; os `estado_*` viram selos e filtros):

| Campo | Valores / formato |
|---|---|
| `estado_documental` | `original_assinado`, `original_sem_assinatura`, `copia_com_tarja`, `reproducao_digital`, `referencia_externa` |
| `estado_deliberativo` | `aprovado_plenario`, `emitido_ad_referendum`, `ratificacao_registrada_em_ata_nao_aprovada`, `referendo_em_minuta_de_ata`, `nao_aplicavel`, `pendente_verificacao` |
| `estado_homologacao` | `homologado`, `nao_exigida`, `pendente`, `nao_localizada` |
| `estado_publicacao` | `publicado_dom`, `publicado_portal_transparencia`, `publicado_neste_portal`, `nao_publicado_oficialmente` |
| `estado_vigencia` | `vigente`, `prazo_encerrado`, `revogado`, `a_confirmar`, `nao_aplicavel` |
| `data_publicacao_oficial`, `data_indexacao` | AAAA-MM-DD |
| `fonte_publicacao_oficial`, `url_publicacao_oficial` | texto; URL https |
| `documento_relacionado` | lista de `id` de documentos |
| `reuniao_id` | `id` da reunião (pauta, ata e convocação: a reunião deve apontar de volta) |
| `paginas_no_arquivo` | ex.: `"p. 2–3"` (quando vários registros usam o mesmo PDF) |
| `natureza_pauta` | `original`, `reproducao_digital` |
| `observacao_publica`, `pendencia_verificacao` | texto público curto |

### `data/reunioes.json` (lista)

`id` estável (ex.: `"2026-11-18-ordinaria"`; sem ele o site usa data + tipo), `data`, `tipo`, `numero`, `local`, `status` (`realizada`, `prevista`, `convocada`, `cancelada`, `sem_quorum`, `sem_registro`), `horario` (ex.: `16h30`, `9h`, `16:30`), `modalidade` (`presencial`, `remota`, `hibrida`), `pauta_id`, `ata_id`, `convocacao_id`, `documentos_relacionados` (lista de ids), `reservada` (true/false), `observacao_publica`. Cada reunião tem âncora `reunioes/index.html#reuniao-<id>`.

### `data/conselheiros.json` (lista)

`nome`, `segmento`, `condicao` (`titular`/`suplente`), `par` (inteiro que liga titular e suplente no segmento), `cargo_mesa`, `mandato`, `fonte`, `ato_url`, `grafia_no_ato`, `entidade`.

### `data/conteudo.json` (objeto)

`sobre`, `faq`, `glossario`, `transparencia` (inclui `como_pedir`), `links_uteis.verificados`, `conselheiros_nota {texto, fonte}`, `composicao_resumo {cadeiras_legais_titulares, cadeiras_legais_suplentes, titulares_nomeados, suplentes_nomeados, mandato_texto, ato_titulo, ato_url, fonte}`. A chave `aviso` e `links_uteis.candidatos_nao_verificados` nunca são exibidas.

## Ferramentas (rodar nesta ordem depois de mudar dados ou molde)

```
python tools/gerar_paginas.py          # páginas a partir do molde (só se o molde mudou; é seguro rodar sempre)
python tools/gerar_ics.py              # calendario.ics a partir de data/reunioes.json
python tools/gerar_sitemap.py          # sitemap.xml e robots.txt
python tools/registrar_atualizacao.py  # data/atualizacao.json (só muda a data do que mudou de verdade)
python tools/checar_links.py --hash    # conferência final: deve terminar com "0 erro(s)"
```

Outras: `python tools/gerar_paginas.py --verificar` (só confere o HTML), `python tools/registrar_atualizacao.py --verificar`, `python tools/preparar_amostra.py` (dados fictícios em `_amostra/`). O passo a passo para cada tipo de documento está no `GUIA_MANUTENCAO.md`.

## Testar localmente

```
python -m http.server 8765
```
e abra `http://127.0.0.1:8765/`. Aberto direto do disco (`file://`), o navegador bloqueia a leitura dos JSON: as páginas mostram um aviso e continuam navegáveis.

Dados fictícios: `python tools/preparar_amostra.py` e `python -m http.server 8765 --directory _amostra`.

## Publicação (GitHub Pages)

A publicação real é **“Deploy from a branch”**: em **Settings → Pages → Build and deployment → Source**, “Deploy from a branch”, branch `main`, pasta `/ (root)`. Não há workflow ativo; o arquivo do workflow antigo foi guardado em `tools/_deploy_workflow/pages.yml.txt` apenas como referência.

Consequências:

- **Tudo o que está versionado na `main` é publicado**, inclusive `tools/` e `data/`. Por isso arquivos internos ficam fora do Git (`.gitignore`: `_relatorios/`, `_revisao/`, `_amostra/`, `data/pendencias.json`, `data/manifesto.csv`).
- O site é atualizado alguns minutos depois do `push` na `main`. Antes do `push`, rode as ferramentas acima e confira `0 erro(s)`.
- `checar_links.py` acusa erro se houver PDF ou documento Office fora de `docs/` que seria publicado.

**Atenção:** tudo o que estiver no repositório público é público, mesmo que não apareça no site.

## Mural (opcional)

O mural usa as Discussões do GitHub. A incorporação via giscus fica **desativada** por padrão; para ativar, habilite Discussions no repositório, instale o app giscus e preencha `giscus` em `site.config.json` (`ativo: true`, `repo`, `repo_id`, `categoria`, `categoria_id`). Sem essa configuração, nenhum script de terceiros é carregado. O formulário de contato **não** cria Issues nem Discussões.

## Licença

Ver `LICENSE`: documentos são atos públicos oficiais; o código do site está sob licença MIT.
