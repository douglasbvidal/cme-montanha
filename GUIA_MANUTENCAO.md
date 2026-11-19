# Guia de manutenção do site do CME Montanha

Passo a passo para a secretaria do Conselho manter o site. Não é preciso saber programar: basta editar arquivos de texto (`.json`) e rodar cinco comandos.

> Regra de ouro: **só publique o que foi aprovado para publicação** (ver `GOVERNANCA.md`). Na dúvida, não publique e registre a pendência.

## 0. Antes de começar

- Tenha o Python 3 instalado e abra o terminal na pasta do site.
- Trabalhe numa cópia atualizada do repositório (`git pull`).
- Edite os `.json` com um editor de texto que salve em UTF-8 (VS Code, Bloco de Notas recente). Cuidado com vírgulas e aspas: o checador acusa JSON inválido.
- Datas sempre no formato `AAAA-MM-DD` (ex.: `2026-11-18`).

### Dados de um PDF (tamanho, páginas e SHA-256)

```
python -c "import hashlib,sys,os;p=sys.argv[1];print('sha256:',hashlib.sha256(open(p,'rb').read()).hexdigest());print('tamanho_kb:',round(os.path.getsize(p)/1024,1))" docs/atas/ata-2026-11-18.pdf
```
O número de páginas aparece no leitor de PDF. No Windows também serve: `certutil -hashfile arquivo.pdf SHA256`.

## 1. Cadastrar uma reunião

Arquivo: `data/reunioes.json`. Acrescente um bloco (copie um existente e ajuste):

```json
{
  "id": "2026-12-16-ordinaria",
  "data": "2026-12-16",
  "tipo": "ordinária",
  "numero": null,
  "horario": "16h",
  "modalidade": "presencial",
  "local": "Casa dos Conselhos",
  "status": "prevista",
  "convocacao_id": null,
  "pauta_id": null,
  "ata_id": null,
  "documentos_relacionados": [],
  "reservada": false,
  "observacao_publica": "Data do calendário oficial."
}
```

- `id`: **data + tipo**, sem acento (`2026-12-16-ordinaria`, `2026-12-16-extraordinaria`). Depois de publicado, **não mude o `id`**: ele é o endereço do cartão (`#reuniao-<id>`) e o identificador no calendário dos celulares.
- `status`: `prevista` (no calendário), `convocada` (convocação expedida), `realizada`, `cancelada`, `sem_quorum`, `sem_registro` (data do calendário sem registro de realização — não entra no `.ics`).
- `modalidade`: `presencial`, `remota` ou `hibrida`. `horario`: `16h`, `16h30` ou `16:30`.
- Reunião **reservada** (`"reservada": true`): o site e o calendário mostram só data, tipo e situação.
- Ao mudar a situação (ex.: de `prevista` para `realizada`), apenas edite o campo `status`.

## 2. Publicar pauta, convocação ou ata

1. Gere o PDF final (a pauta pode seguir o modelo institucional; a secretaria tem um gerador próprio em `tools/gerar_pauta_pdf.py`).
2. Copie o PDF para `docs/pautas/`, `docs/convocacoes/` ou `docs/atas/` (nome sem espaço e sem acento, ex.: `pauta-2026-12-16-ordinaria.pdf`).
3. Em `data/documentos.json`, acrescente o registro:

```json
{
  "id": "pauta-2026-12-16-ordinaria",
  "categoria": "pautas",
  "titulo": "Pauta — Reunião Ordinária de 16/12/2026",
  "numero": null, "ano": 2026, "data": "2026-12-09",
  "emissor": "Conselho Municipal de Educação de Montanha/ES (CME-MO)",
  "assunto": "Pauta da reunião ordinária de 16/12/2026.",
  "arquivo": "docs/pautas/pauta-2026-12-16-ordinaria.pdf",
  "tamanho_kb": 64.2, "paginas": 1,
  "status": "referencia",
  "sha256": "…64 caracteres…",
  "reuniao_id": "2026-12-16-ordinaria",
  "natureza_pauta": "original",
  "estado_documental": "original_assinado",
  "data_indexacao": "2026-12-09",
  "fonte_original": null, "observacao": ""
}
```

4. Na reunião correspondente (`data/reunioes.json`), preencha `pauta_id` (ou `convocacao_id`, `ata_id`) com o mesmo `id`. **As duas pontas precisam concordar**: o checador acusa erro se o documento disser `reuniao_id` e a reunião não apontar de volta.
5. **Ata**: só depois de aprovada pelo Plenário e assinada. Use `"categoria": "atas"` e `"estado_deliberativo": "aprovado_plenario"`.

## 3. Publicar resolução ou parecer

Igual ao item 2, com o PDF em `docs/resolucoes/` ou `docs/pareceres/` e `"categoria": "resolucoes"` ou `"pareceres"`. Informe, quando souber com documento:

- `numero` como aparece no ato (`"004/2026"`); a busca acha também `004-2026` e `4/2026`.
- `estado_deliberativo`: `aprovado_plenario`, `emitido_ad_referendum`, `ratificacao_registrada_em_ata_nao_aprovada`, `referendo_em_minuta_de_ata` ou `pendente_verificacao`.
- `estado_homologacao`: `homologado` (exige `data_publicacao_oficial` e `fonte_publicacao_oficial` ou `url_publicacao_oficial`), `nao_exigida`, `pendente`, `nao_localizada`.
- `estado_publicacao`: `publicado_dom` (com `data_publicacao_oficial`, `fonte_publicacao_oficial` e, se houver, `url_publicacao_oficial`), `publicado_portal_transparencia`, `publicado_neste_portal`, `nao_publicado_oficialmente`.
- `estado_vigencia`: `vigente`, `prazo_encerrado`, `revogado`, `a_confirmar`.
- `reuniao_id` da reunião que aprovou; `documento_relacionado` com ids de atos ligados.
- Vários atos no mesmo PDF: um registro para cada ato, todos com o mesmo `arquivo` e `sha256`, e `paginas_no_arquivo` (ex.: `"p. 2–3"`).
- O que ainda falta comprovar vai em `pendencia_verificacao` (texto curto, público).

Ato publicado só no Diário Oficial (sem PDF hospedado): `"externo": true`, `"url": "https://..."`, `arquivo` e `sha256` nulos.

## 4. Publicar ofício

PDF em `docs/oficios/`, `"categoria": "oficios"`. Somente ofícios já assinados e enviados, sem dados pessoais de terceiros (cubra com tarja e use `"estado_documental": "copia_com_tarja"`). Se a cópia não tem assinatura, use `"estado_documental": "original_sem_assinatura"` e diga isso em `observacao`.

## 5. Publicar boletim semestral ou relatório anual (art. 21 da Lei 1.166/2024)

1. Use os modelos `tools/modelos/boletim_semestral.md` e `tools/modelos/relatorio_anual.md` (marcados como MODELO; leia as instruções no topo).
2. A página **Transparência → Atos do Conselho por ano** ajuda a montar a lista, mas confira cada item no original.
3. Depois de aprovado e assinado: PDF em `docs/boletins/`, registro com `"categoria": "boletins"`. Enquanto não houver boletim, o site mostra “Nenhum boletim publicado até o momento”.

## 6. Composição do Conselho

- `data/conselheiros.json`: uma pessoa por bloco; titular e suplente da mesma vaga têm o mesmo `par` (1, 2…) dentro do segmento. Nome como no ato; se o ato traz grafia diferente, registre em `grafia_no_ato`.
- `data/conteudo.json → composicao_resumo`: cadeiras previstas em lei e quantos foram nomeados, mandato, ato de nomeação (título e link) e fonte. `conselheiros_nota`: situação atual (ex.: recomposição pedida).
- Só mude a composição com **ato oficial** (decreto/portaria publicado).

## 7. Rodar as ferramentas (sempre nesta ordem)

```
python tools/gerar_paginas.py
python tools/gerar_ics.py
python tools/gerar_sitemap.py
python tools/registrar_atualizacao.py
python tools/checar_links.py --hash
```

- `gerar_paginas` regrava as páginas a partir do molde (seguro rodar sempre).
- `gerar_ics` refaz o `calendario.ics`; com os mesmos dados o arquivo sai idêntico.
- `registrar_atualizacao` grava `data/atualizacao.json`. Ele só muda a data de um conjunto (acervo, calendário, composição, conteúdo) quando o conteúdo mudou de verdade. A data do acervo aparece no rodapé: “Última atualização do acervo”.
- `checar_links` precisa terminar com **`0 erro(s)`**. Avisos devem ser lidos, mas não impedem a publicação. Se aparecer “calendario.ics: só o DTSTAMP difere”, rode de novo `gerar_ics` e `checar_links`.

## 8. Conferir e publicar

1. Veja o resultado no computador: `python -m http.server 8765` e abra `http://127.0.0.1:8765/`.
2. Confira a página alterada, o cartão da reunião e a busca (pelo número do ato).
3. Registre a mudança no Git com mensagem clara (ex.: `Pauta da reunião ordinária de 16/12/2026`) e envie para a branch `main` (quem tem permissão no repositório). O GitHub Pages publica em alguns minutos.
4. Abra o site publicado e confira a página.

## 9. Corrigir ou retirar algo

- Correção de dado: edite o `.json`, rode as ferramentas e publique. O histórico do Git guarda a versão anterior.
- Retirar um PDF: apague o arquivo de `docs/` **e** o registro em `documentos.json` (e as referências em `reunioes.json`). O checador acusa arquivo fora do catálogo ou referência quebrada.
- Pedido de retirada de dado pessoal: ver `GOVERNANCA.md`.
