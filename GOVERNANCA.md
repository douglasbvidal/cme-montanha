# Governança do site do CME Montanha

Regras para manter o site confiável ao longo do tempo, independentemente de quem o administra.

## 1. Natureza do site

- O site é um **repositório de consulta** dos atos e registros públicos do Conselho.
- **Não substitui** o Diário Oficial (publicação oficial dos atos), o protocolo oficial (recebimento de requerimentos) nem o documento original assinado. Em caso de divergência, prevalece o documento oficial.
- O site não recebe mensagens, não protocola documentos e não guarda dados de visitantes.

## 2. Fluxo de aprovação de uma publicação

1. **Origem**: o documento existe na versão final (assinado, aprovado ou enviado, conforme o tipo).
2. **Triagem de publicidade** pela secretaria (critérios do item 3).
3. **Preparação**: PDF em `docs/`, registro em `data/*.json`, ferramentas rodadas (ver `GUIA_MANUTENCAO.md`), `checar_links.py` com `0 erro(s)`.
4. **Conferência por uma segunda pessoa**, quando possível (outro membro da Mesa ou da secretaria): título, data, número, estado e PDF corretos.
5. **Publicação** na branch `main` pela pessoa com permissão no repositório.
6. **Registro**: a mensagem do commit diz o que entrou ou mudou; o histórico do Git é o controle de revisões.

Atas: só depois de aprovadas pelo Plenário. Pareceres ad referendum: publicar com o estado `emitido_ad_referendum` até o referendo constar em ata aprovada.

## 3. Critérios de publicidade

Publica-se:
- atos do Conselho (resoluções, pareceres, indicações, deliberações), regimento, pautas, convocações, atas aprovadas, ofícios enviados, boletins e relatórios;
- links oficiais para atos de outros órgãos (leis, decretos, portarias), sem hospedar a cópia.

Não se publica:
- dados pessoais desnecessários (CPF, RG, telefone e e-mail pessoais, endereço residencial, dados de saúde);
- documentos sobre crianças e adolescentes identificados, ou sobre estudantes, famílias e servidores em situação individual;
- matéria de sessão reservada (o site mostra só data, tipo e situação da reunião);
- minutas, rascunhos, versões de trabalho e documentos ainda não aprovados ou não assinados (exceto quando o próprio estado diz isso, ex.: `original_sem_assinatura`, com justificativa na observação).

Dados pessoais de terceiros em documento publicável: cobrir com tarja e registrar `estado_documental: copia_com_tarja`. Base: Constituição, art. 37 (publicidade); Lei nº 12.527/2011 (acesso à informação); Lei nº 13.709/2018 (LGPD).

## 4. Acervo público × arquivos internos

| Público (versionado e publicado) | Interno (NUNCA versionado) |
|---|---|
| `docs/`, `data/documentos.json`, `data/reunioes.json`, `data/conselheiros.json`, `data/conteudo.json`, `data/atualizacao.json`, `calendario.ics`, páginas, `assets/`, `tools/` | `_relatorios/` (relatórios e scripts internos), `_revisao/` (documentos em revisão), `_amostra/` (dados fictícios de teste), `data/pendencias.json`, `data/manifesto.csv` |

- A publicação é “Deploy from a branch” (`main`, raiz): **tudo o que é versionado fica público**, mesmo o que não aparece nas páginas.
- O `.gitignore` mantém as pastas internas fora do Git. Não use `git add -f` nelas.
- `checar_links.py` acusa erro se um PDF ou documento Office fora de `docs/` estiver a caminho de ser publicado, e se houver arquivo em `docs/` sem registro no catálogo.
- O acervo completo (originais, versões editáveis, comprovantes) fica nos arquivos oficiais do Conselho, fora deste repositório.

## 5. Controle de revisões

- Cada mudança é um commit com mensagem descritiva; não reescreva o histórico da `main` (sem `push --force`).
- Mudanças maiores (molde, ferramentas) devem ser feitas numa branch separada e conferidas antes de entrar na `main`.
- `data/atualizacao.json` registra a data da última mudança real de cada conjunto de dados; o rodapé mostra a do acervo.
- Correções de documento publicado: substituir o PDF, atualizar `sha256` e explicar na `observacao` o que mudou e quando.

## 6. Backup e restauração

- **Backup**: o próprio repositório no GitHub guarda todas as versões. Recomenda-se também manter uma cópia local atualizada (`git clone` / `git pull`) em computador da secretaria e, periodicamente, um arquivo compactado do repositório junto ao acervo oficial do Conselho.
- **Restaurar um arquivo** a uma versão anterior: `git log -- caminho/do/arquivo` para achar a versão e `git checkout <commit> -- caminho/do/arquivo`; depois rode as ferramentas e publique.
- **Desfazer uma publicação errada**: `git revert <commit>` (cria um novo commit que desfaz o anterior, sem apagar histórico) e publique.
- Se um dado pessoal for publicado por engano, retire-o imediatamente (novo commit). O histórico do Git ainda o conterá: avalie com o responsável pelo repositório a limpeza do histórico e a solicitação de remoção de cache ao GitHub.

## 7. Administração e sucessão

- O repositório deve ter **pelo menos dois administradores** vinculados ao Conselho (por exemplo, a Presidência e a secretaria), para não depender de uma única pessoa. Este documento **não concede acesso a ninguém**: a concessão é ato do responsável atual, registrado em ata ou ofício.
- Na troca de gestão: (1) o novo responsável é indicado formalmente; (2) o responsável atual concede acesso à conta indicada; (3) confere-se que o novo responsável consegue publicar; (4) os acessos de quem saiu são retirados; (5) a mudança é registrada.
- Contas pessoais não devem ser a única forma de acesso. Se o Município ou o Conselho tiver uma organização no GitHub, prefira transferir o repositório para ela (Settings → Transfer), mantendo o endereço publicado ou redirecionando.
- Senhas e tokens nunca são guardados no repositório nem em documentos públicos.

## 8. Pedidos de cidadãos

- **Correção ou retirada de dado pessoal**: pelo e-mail institucional do Conselho (página Privacidade). Analisar, responder e, quando cabível, publicar versão com tarja, preservando o original nos arquivos do Conselho.
- **Pedido formal de informação (LAI)**: segue pelo SIC da Prefeitura (presencial ou Informa.BR), que registra o pedido e conta o prazo.
- O formulário do site só abre o e-mail do visitante; não há Issues ou Discussões automáticas com mensagens de cidadãos. O mural (Discussões do GitHub) é público e moderado.
