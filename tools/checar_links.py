# -*- coding: utf-8 -*-
"""Checa links, arquivos e coerência dos dados do site do CME Montanha.

Uso:  python tools/checar_links.py [pasta_do_site] [--hash] [--sem-pdf]
  pasta_do_site  padrão: a pasta acima de tools/ (o site real). Ex.: _amostra para os dados de teste.
  --hash         recalcula o SHA-256 de cada PDF e compara com data/documentos.json.
  --sem-pdf      não abre os PDFs para conferir texto selecionável (mais rápido).

Saída: ERROS (impedem a publicação) e AVISOS (conferir). Código de saída 1 se houver erro.
Verifica, entre outros: links relativos e recursos externos; páginas iguais ao molde de
tools/gerar_paginas.py; arquivos e SHA-256; ids repetidos; referências entre documentos e reuniões
(pauta_id, ata_id, convocacao_id, documento_relacionado, documentos_relacionados, reuniao_id) e a
categoria coerente; vocabulário dos estados; datas; URLs; combinações incoerentes; PDFs sem texto
selecionável (PyMuPDF, se instalado); integridade do calendario.ics; arquivos de docs/ fora do
catálogo e PDFs fora de docs/. Biblioteca padrão (PyMuPDF/pypdf são opcionais).
"""
import hashlib
import importlib
import json
import re
import subprocess
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

FERRAMENTAS = Path(__file__).resolve().parent
sys.path.insert(0, str(FERRAMENTAS))

IGNORAR_PASTAS = {'_amostra', '_relatorios', '_revisao', 'tools', '.git', '.github', '_site', 'node_modules'}
CATEGORIAS = {'legislacao', 'regimento', 'resolucoes', 'pareceres', 'oficios', 'pautas', 'atas', 'outros',
              'boletins', 'convocacoes'}
STATUS_DOC = {'vigente', 'assinado', 'enviado', 'em_estudo', 'referencia'}
STATUS_REUNIAO = {'realizada', 'prevista', 'convocada', 'cancelada', 'sem_quorum', 'sem_registro'}
ESTADOS = {
    'estado_documental': {'original_assinado', 'original_sem_assinatura', 'copia_com_tarja', 'reproducao_digital', 'referencia_externa'},
    'estado_deliberativo': {'aprovado_plenario', 'emitido_ad_referendum', 'ratificacao_registrada_em_ata_nao_aprovada',
                            'referendo_em_minuta_de_ata', 'nao_aplicavel', 'pendente_verificacao'},
    'estado_homologacao': {'homologado', 'nao_exigida', 'pendente', 'nao_localizada'},
    'estado_publicacao': {'publicado_dom', 'publicado_portal_transparencia', 'publicado_neste_portal', 'nao_publicado_oficialmente'},
    'estado_vigencia': {'vigente', 'prazo_encerrado', 'revogado', 'a_confirmar', 'nao_aplicavel'},
    'natureza_pauta': {'original', 'reproducao_digital'},
}
MODALIDADES = {'presencial', 'remota', 'hibrida'}
CONDICOES = {'titular', 'suplente'}
REF_CATEGORIA = {'pauta_id': 'pautas', 'ata_id': 'atas', 'convocacao_id': 'convocacoes'}
ESQUEMAS_EXTERNOS = ('http:', 'https:', 'mailto:', 'tel:', 'webcal:', 'data:', 'javascript:')
EXT_DOCUMENTO = {'.pdf', '.doc', '.docx', '.odt', '.xls', '.xlsx', '.ods', '.ppt', '.pptx', '.rtf'}
RE_URL = re.compile(r'https?://[^\s"\'<>]+\.[^\s"\'<>]+')


class Coletor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []      # (tag, atributo, valor, linha)
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.add(a['id'])
        for nome in ('href', 'src', 'action'):
            if nome in a and a[nome] is not None:
                self.refs.append((tag, nome, a[nome], self.getpos()[0]))


def resolver(base_dir, raiz, caminho):
    alvo = (base_dir / unquote(caminho)).resolve()
    try:
        alvo.relative_to(raiz)
    except ValueError:
        return None, 'sai da pasta do site'
    if caminho.endswith('/') or alvo.is_dir():
        alvo = alvo / 'index.html'
    return alvo, ''


def data_valida(v):
    if not isinstance(v, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', v):
        return False
    try:
        date.fromisoformat(v)
        return True
    except ValueError:
        return False


def url_valida(u):
    return isinstance(u, str) and bool(RE_URL.fullmatch(u))


def arquivos_servidos(raiz):
    """Arquivos que iriam ao repositório público (versionados + novos não ignorados).
    Sem Git, varre a pasta ignorando as pastas internas."""
    if (raiz / '.git').exists():
        try:
            out = subprocess.run(['git', '-C', str(raiz), 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
                                 capture_output=True, check=True).stdout.decode('utf-8')
            return {p for p in out.split('\0') if p and (raiz / p).exists()}, 'git'
        except (OSError, subprocess.CalledProcessError):
            pass
    res = set()
    for p in raiz.rglob('*'):
        if p.is_file():
            rel = p.relative_to(raiz)
            if rel.parts[0] not in IGNORAR_PASTAS:
                res.add(rel.as_posix())
    return res, 'pasta'


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    conferir_hash = '--hash' in sys.argv
    conferir_pdf = '--sem-pdf' not in sys.argv
    raiz = Path(args[0]).resolve() if args else FERRAMENTAS.parent
    erros, avisos = [], []
    paginas = 0

    # ---------------- HTML ----------------
    for html in sorted(raiz.rglob('*.html')):
        rel = html.relative_to(raiz)
        if rel.parts[0] in IGNORAR_PASTAS or rel.parts[0] == 'docs':
            continue
        paginas += 1
        c = Coletor()
        texto = html.read_text(encoding='utf-8')
        c.feed(texto)
        if '<title>' not in texto:
            erros.append(f'{rel}: sem <title>')
        if 'name="description"' not in texto:
            erros.append(f'{rel}: sem meta description')
        for tag, attr, valor, linha in c.refs:
            v = valor.strip()
            if not v:
                erros.append(f'{rel}:{linha}: {tag}[{attr}] vazio')
                continue
            if v.startswith('//'):
                erros.append(f'{rel}:{linha}: URL sem protocolo (externa) em {tag}[{attr}]: {v}')
                continue
            if v.lower().startswith(ESQUEMAS_EXTERNOS):
                if tag in ('script', 'link', 'img', 'iframe') and v.lower().startswith(('http:', 'https:')):
                    erros.append(f'{rel}:{linha}: recurso externo carregado ({tag}): {v}')
                elif v.lower().startswith(('http:', 'https:')) and not url_valida(v):
                    erros.append(f'{rel}:{linha}: URL malformada: {v}')
                continue
            if v.startswith('#'):
                if v != '#' and v[1:] not in c.ids:
                    avisos.append(f'{rel}:{linha}: âncora {v} não existe no HTML estático (pode ser gerada por script)')
                continue
            if v.startswith('/'):
                erros.append(f'{rel}:{linha}: caminho absoluto (quebra no GitHub Pages de projeto): {v}')
                continue
            caminho = urlsplit(v).path
            if not caminho:
                continue
            alvo, motivo = resolver(html.parent, raiz, caminho)
            if alvo is None:
                erros.append(f'{rel}:{linha}: {v} ({motivo})')
            elif not alvo.exists():
                rel_alvo = alvo.relative_to(raiz).as_posix()
                dado = rel_alvo.startswith(('data/', 'docs/')) or rel_alvo == 'calendario.ics'
                (avisos if dado else erros).append(
                    f'{rel}:{linha}: link para arquivo inexistente: {v}' + (' (dado ainda não gerado)' if dado else ''))

    # ---------------- Páginas x molde (tools/gerar_paginas.py) ----------------
    try:
        gp = importlib.import_module('gerar_paginas')
        for d in gp.divergentes(raiz):
            erros.append(f'{d}: diferente do molde de tools/gerar_paginas.py (rode python tools/gerar_paginas.py; não edite o HTML à mão)')
    except Exception as ex:  # noqa: BLE001 - qualquer falha do gerador é erro de publicação
        erros.append(f'tools/gerar_paginas.py: erro ao gerar as páginas ({type(ex).__name__}: {ex})')

    # ---------------- CSS e JS ----------------
    for css in raiz.glob('assets/**/*.css'):
        t = css.read_text(encoding='utf-8')
        for m in re.finditer(r'url\(\s*["\']?([^"\')]+)', t):
            u = m.group(1)
            if u.startswith(('http:', 'https:', '//')):
                erros.append(f'{css.relative_to(raiz)}: recurso externo em CSS: {u}')
            elif u.startswith('/'):
                erros.append(f'{css.relative_to(raiz)}: caminho absoluto em CSS: {u}')
            elif not u.startswith('data:') and not (css.parent / u).exists():
                erros.append(f'{css.relative_to(raiz)}: url() inexistente: {u}')
        if '@import' in t:
            avisos.append(f'{css.relative_to(raiz)}: contém @import')
    for js in raiz.glob('assets/**/*.js'):
        t = js.read_text(encoding='utf-8')
        for m in re.finditer(r"carregar\('([^']+)'\)", t):
            if not (raiz / m.group(1)).exists():
                avisos.append(f'{js.relative_to(raiz)}: arquivo de dados ainda inexistente: {m.group(1)} (o site mostra estado vazio)')
        for m in re.finditer(r"['\"](https?://[^'\"]+)['\"]", t):
            if 'github.com' not in m.group(1) and 'giscus.app' not in m.group(1):
                avisos.append(f'{js.relative_to(raiz)}: URL externa no código: {m.group(1)}')
        if re.search(r'google-analytics|gtag\(|googletagmanager|facebook\.net|hotjar|matomo|plausible', t, re.I):
            erros.append(f'{js.relative_to(raiz)}: parece carregar rastreador/analytics')

    # ---------------- Dados ----------------
    def ler_json(nome, obrigatorio=False):
        p = raiz / nome
        if not p.exists():
            (erros if obrigatorio else avisos).append(f'{nome}: ausente')
            return None
        try:
            return json.loads(p.read_text(encoding='utf-8-sig'))
        except ValueError as e:
            erros.append(f'{nome}: JSON inválido ({e})')
            return None

    cfg = ler_json('site.config.json', obrigatorio=True)
    if isinstance(cfg, dict):
        for k in ('email_publico', 'endereco', 'telefone_publico', 'repositorio', 'url_site'):
            if k not in cfg:
                erros.append(f'site.config.json: falta a chave "{k}"')
        em = str(cfg.get('email_publico') or '')
        if em and not re.fullmatch(r'[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+', em):
            erros.append(f'site.config.json: email_publico malformado: {em!r}')
        if cfg.get('url_site') and not url_valida(str(cfg['url_site'])):
            erros.append('site.config.json: url_site malformada')

    docs = ler_json('data/documentos.json')
    docs = docs if isinstance(docs, list) else ([] if docs is None else (erros.append('data/documentos.json: deveria ser uma lista') or []))
    reun = ler_json('data/reunioes.json')
    reun = reun if isinstance(reun, list) else ([] if reun is None else (erros.append('data/reunioes.json: deveria ser uma lista') or []))

    por_id = {}
    for i, d in enumerate(docs):
        if isinstance(d, dict) and d.get('id') not in (None, ''):
            por_id.setdefault(str(d['id']), d)

    # ids de reunião: mesmo algoritmo do site e do gerar_ics
    try:
        ics_mod = importlib.import_module('gerar_ics')
        ids_r = ics_mod.ids_reunioes(reun)
    except Exception as ex:  # noqa: BLE001
        erros.append(f'tools/gerar_ics.py: não foi possível importar ({ex})')
        ics_mod, ids_r = None, [str(i) for i in range(len(reun))]
    reun_por_id = {rid: r for rid, r in zip(ids_r, reun) if isinstance(r, dict)}

    ids_vistos = set()
    sem_fonte, arquivos_usados = [], {}
    for i, d in enumerate(docs):
        ref = f'data/documentos.json[{i}]'
        if not isinstance(d, dict):
            erros.append(f'{ref}: item não é objeto')
            continue
        did = d.get('id')
        if did in (None, ''):
            erros.append(f'{ref}: sem id')
        elif str(did) in ids_vistos:
            erros.append(f'{ref}: id repetido {did}')
        else:
            ids_vistos.add(str(did))
            ref = f'documentos[{did}]'
        cat = d.get('categoria')
        if cat not in CATEGORIAS:
            erros.append(f'{ref}: categoria inválida {cat!r}')
        if d.get('status') not in STATUS_DOC:
            avisos.append(f'{ref}: status fora do esquema {d.get("status")!r}')
        for campo, valores in ESTADOS.items():
            v = d.get(campo)
            if v is not None and v not in valores:
                erros.append(f'{ref}: {campo}={v!r} fora do vocabulário ({", ".join(sorted(valores))})')
        for campo in ('data', 'data_publicacao_oficial', 'data_indexacao'):
            v = d.get(campo)
            if v is not None and not data_valida(v):
                erros.append(f'{ref}: {campo} inválida (use AAAA-MM-DD com data existente): {v!r}')
        for campo in ('url', 'url_publicacao_oficial'):
            v = d.get(campo)
            if v not in (None, '') and not url_valida(v):
                erros.append(f'{ref}: {campo} malformada: {v!r}')
            elif isinstance(v, str) and v.startswith('http://'):
                avisos.append(f'{ref}: {campo} em http:// (prefira https://): {v}')
        arq = str(d.get('arquivo') or '').replace('\\', '/')
        if d.get('externo') is True:
            if not url_valida(d.get('url')):
                erros.append(f'{ref}: documento externo sem url válida')
            if arq:
                avisos.append(f'{ref}: documento externo com "arquivo" preenchido (o site usa só a url)')
        elif not arq.startswith('docs/') or '..' in arq:
            erros.append(f'{ref}: arquivo deve estar em docs/: {arq!r}')
        else:
            arquivos_usados.setdefault(arq, []).append(d)
            p = raiz / arq
            if not p.exists():
                erros.append(f'{ref}: PDF inexistente: {arq}')
            elif conferir_hash and d.get('sha256'):
                h = hashlib.sha256(p.read_bytes()).hexdigest()
                if h != str(d['sha256']).lower():
                    erros.append(f'{ref}: SHA-256 não confere para {arq}')
            if not d.get('sha256'):
                erros.append(f'{ref}: PDF hospedado sem sha256')
        sha = str(d.get('sha256') or '')
        if sha and not re.fullmatch(r'[0-9a-fA-F]{64}', sha):
            erros.append(f'{ref}: sha256 com formato inválido')
        fonte = str(d.get('fonte_original') or '')
        if re.search(r'^[A-Za-z]:[\\/]|[\\/]Users[\\/]|OneDrive', fonte, re.I):
            avisos.append(f'{ref}: fonte_original parece caminho local (o site não a exibe; o JSON público a expõe)')
        if not any(d.get(k) for k in ('fonte_original', 'fonte_publicacao_oficial', 'url_publicacao_oficial')) and not d.get('externo'):
            sem_fonte.append(str(did))
        # relações
        rel = d.get('documento_relacionado')
        if rel is not None:
            if not isinstance(rel, list):
                erros.append(f'{ref}: documento_relacionado deve ser lista de ids')
            else:
                for x in rel:
                    if str(x) not in por_id:
                        erros.append(f'{ref}: documento_relacionado aponta para id inexistente {x!r}')
                    elif str(x) == str(did):
                        avisos.append(f'{ref}: documento_relacionado aponta para o próprio documento')
        rid = d.get('reuniao_id')
        if rid not in (None, ''):
            r = reun_por_id.get(str(rid))
            if r is None:
                erros.append(f'{ref}: reuniao_id={rid!r} não existe em reunioes.json')
            else:
                campo = {'pautas': 'pauta_id', 'atas': 'ata_id', 'convocacoes': 'convocacao_id'}.get(cat)
                if campo and str(r.get(campo) or '') != str(did):
                    nome_cat = {'pautas': 'pauta', 'atas': 'ata', 'convocacoes': 'convocação'}[cat]
                    erros.append(f'{ref}: é {nome_cat} da reunião {rid}, mas a reunião não aponta de volta ({campo}={r.get(campo)!r})')
        # coerência
        if d.get('estado_homologacao') == 'homologado' and not (d.get('data_publicacao_oficial') and (d.get('fonte_publicacao_oficial') or d.get('url_publicacao_oficial'))):
            erros.append(f'{ref}: estado_homologacao=homologado sem data_publicacao_oficial e fonte/url da publicação oficial')
        if d.get('estado_publicacao') in ('publicado_dom', 'publicado_portal_transparencia') and not (
                d.get('fonte_publicacao_oficial') or d.get('url_publicacao_oficial') or d.get('externo')):
            avisos.append(f'{ref}: estado_publicacao={d.get("estado_publicacao")} sem fonte_publicacao_oficial nem url')
        if d.get('estado_vigencia') == 'revogado' and d.get('status') == 'vigente':
            erros.append(f'{ref}: estado_vigencia=revogado com status=vigente')
        if d.get('estado_documental') == 'referencia_externa' and d.get('externo') is not True:
            avisos.append(f'{ref}: estado_documental=referencia_externa em documento hospedado')
        if data_valida(d.get('data')) and data_valida(d.get('data_publicacao_oficial')) and d['data_publicacao_oficial'] < d['data']:
            avisos.append(f'{ref}: data_publicacao_oficial anterior à data do documento')
        if data_valida(d.get('data_indexacao')) and d['data_indexacao'] > date.today().isoformat():
            avisos.append(f'{ref}: data_indexacao no futuro')
        if d.get('natureza_pauta') is not None and cat != 'pautas':
            avisos.append(f'{ref}: natureza_pauta em documento que não é pauta')
    for arq, lista in arquivos_usados.items():
        if len(lista) > 1 and any(not x.get('paginas_no_arquivo') for x in lista):
            avisos.append(f'{arq}: usado por {len(lista)} registros; informe paginas_no_arquivo em cada um')
    if sem_fonte:
        avisos.append(f'{len(sem_fonte)} documento(s) hospedado(s) sem fonte registrada (fonte_original, fonte_publicacao_oficial ou url_publicacao_oficial): '
                      + ', '.join(sem_fonte))

    # reuniões
    ids_explicitos, sem_id = set(), []
    for i, r in enumerate(reun):
        if not isinstance(r, dict):
            erros.append(f'data/reunioes.json[{i}]: item não é objeto')
            continue
        rid = ids_r[i]
        ref = f'reunioes[{rid}]'
        if r.get('id') in (None, ''):
            sem_id.append(rid)
        else:
            if str(r['id']) in ids_explicitos:
                erros.append(f'{ref}: id repetido {r["id"]!r}')
            ids_explicitos.add(str(r['id']))
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', str(r['id'])):
                erros.append(f'{ref}: id com caracteres inválidos (use letras, números, ponto, hífen): {r["id"]!r}')
        if not data_valida(r.get('data')):
            erros.append(f'{ref}: data inválida {r.get("data")!r}')
        if r.get('status') not in STATUS_REUNIAO:
            erros.append(f'{ref}: status fora do vocabulário {r.get("status")!r}')
        if r.get('modalidade') is not None and r.get('modalidade') not in MODALIDADES:
            erros.append(f'{ref}: modalidade fora do vocabulário {r.get("modalidade")!r}')
        if r.get('horario') not in (None, '') and ics_mod and ics_mod.horario(r.get('horario')) is None:
            erros.append(f'{ref}: horario não reconhecido {r.get("horario")!r} (use 16h30, 9h ou 16:30)')
        if r.get('reservada') not in (None, True, False):
            erros.append(f'{ref}: reservada deve ser true ou false')
        for campo, cat_esperada in REF_CATEGORIA.items():
            v = r.get(campo)
            if v in (None, ''):
                continue
            d = por_id.get(str(v))
            if d is None:
                erros.append(f'{ref}: {campo}={v!r} não existe em documentos.json')
            elif d.get('categoria') != cat_esperada:
                erros.append(f'{ref}: {campo}={v!r} aponta para documento da categoria {d.get("categoria")!r} (esperado {cat_esperada!r})')
            elif d.get('reuniao_id') not in (None, '') and str(d.get('reuniao_id')) != rid:
                erros.append(f'{ref}: {campo}={v!r}, mas o documento aponta para outra reunião ({d.get("reuniao_id")!r})')
        rel = r.get('documentos_relacionados')
        if rel is not None:
            if not isinstance(rel, list):
                erros.append(f'{ref}: documentos_relacionados deve ser lista de ids')
            else:
                for x in rel:
                    if str(x) not in por_id:
                        erros.append(f'{ref}: documentos_relacionados aponta para id inexistente {x!r}')
        tem_doc = any(r.get(k) for k in REF_CATEGORIA)
        if r.get('status') == 'sem_registro' and tem_doc:
            erros.append(f'{ref}: status sem_registro com pauta/ata/convocação vinculada')
        if r.get('status') == 'cancelada' and r.get('ata_id'):
            avisos.append(f'{ref}: reunião cancelada com ata vinculada')
        if r.get('reservada') is True and tem_doc:
            avisos.append(f'{ref}: reunião reservada com pauta/ata/convocação (o site não as exibe)')
        if r.get('status') == 'realizada' and data_valida(r.get('data')) and r['data'] > date.today().isoformat():
            avisos.append(f'{ref}: status realizada com data futura')
    if sem_id:
        avisos.append(f'{len(sem_id)} reunião(ões) sem "id" (usado o identificador data+tipo): ' + ', '.join(sem_id))

    # composição
    cons = ler_json('data/conselheiros.json')
    if cons is not None and not isinstance(cons, list):
        erros.append('data/conselheiros.json: deveria ser uma lista')
        cons = []
    cons = cons or []
    pares = {}
    for i, p in enumerate(cons):
        ref = f'conselheiros[{i}]'
        if not isinstance(p, dict) or not p.get('nome'):
            erros.append(f'{ref}: item sem nome')
            continue
        if p.get('condicao') not in CONDICOES:
            erros.append(f'{ref}: condicao fora do vocabulário {p.get("condicao")!r}')
        par = p.get('par')
        if par is not None:
            if not isinstance(par, int) or isinstance(par, bool):
                erros.append(f'{ref}: par deve ser inteiro')
            else:
                k = (p.get('segmento'), par, p.get('condicao'))
                if k in pares:
                    erros.append(f'{ref}: dois {p.get("condicao")}s no mesmo par {par} do segmento {p.get("segmento")!r}')
                pares[k] = p
        if p.get('ato_url') not in (None, '') and not url_valida(p.get('ato_url')):
            erros.append(f'{ref}: ato_url malformada')
    cont = ler_json('data/conteudo.json')
    if cont is not None and not isinstance(cont, dict):
        erros.append('data/conteudo.json: deveria ser um objeto')
        cont = {}
    cont = cont or {}
    res = cont.get('composicao_resumo')
    if isinstance(res, dict):
        if res.get('ato_url') not in (None, '') and not url_valida(res.get('ato_url')):
            erros.append('conteudo.composicao_resumo.ato_url malformada')
        tit = sum(1 for p in cons if isinstance(p, dict) and p.get('condicao') == 'titular')
        sup = sum(1 for p in cons if isinstance(p, dict) and p.get('condicao') == 'suplente')
        if isinstance(res.get('titulares_nomeados'), int) and res['titulares_nomeados'] != tit:
            avisos.append(f'composicao_resumo.titulares_nomeados={res["titulares_nomeados"]}, mas conselheiros.json lista {tit} titulares')
        if isinstance(res.get('suplentes_nomeados'), int) and res['suplentes_nomeados'] != sup:
            avisos.append(f'composicao_resumo.suplentes_nomeados={res["suplentes_nomeados"]}, mas conselheiros.json lista {sup} suplentes')
        for a, b in (('titulares_nomeados', 'cadeiras_legais_titulares'), ('suplentes_nomeados', 'cadeiras_legais_suplentes')):
            if isinstance(res.get(a), int) and isinstance(res.get(b), int) and res[a] > res[b]:
                erros.append(f'composicao_resumo: {a} maior que {b}')
    lu = cont.get('links_uteis')
    for l in (lu.get('verificados') or []) if isinstance(lu, dict) else []:
        if isinstance(l, dict) and not url_valida(l.get('url')):
            avisos.append(f'links_uteis.verificados: URL malformada ou não http(s) (o site não a exibe): {l.get("url")!r}')

    # registro de atualização
    try:
        reg = importlib.import_module('registrar_atualizacao')
        registro = reg.ler_registro(raiz)
        if not registro:
            avisos.append('data/atualizacao.json: ausente (o rodapé não mostra data; rode tools/registrar_atualizacao.py)')
        else:
            for nome, h in reg.hashes_atuais(raiz).items():
                item = registro.get(nome)
                if not isinstance(item, dict) or not data_valida(item.get('data')):
                    avisos.append(f'data/atualizacao.json: item {nome} ausente ou sem data válida')
                elif h is not None and item.get('hash') != h:
                    avisos.append(f'data/atualizacao.json: {nome} mudou desde o último registro (rode tools/registrar_atualizacao.py)')
    except Exception as ex:  # noqa: BLE001
        erros.append(f'tools/registrar_atualizacao.py: falhou ({ex})')

    # ---------------- docs/: catálogo x pasta; PDFs fora de docs/ ----------------
    if (raiz / 'docs').is_dir():
        for p in sorted((raiz / 'docs').rglob('*')):
            if p.is_file() and p.name.lower() not in {'desktop.ini', 'thumbs.db', '.ds_store'}:
                relp = p.relative_to(raiz).as_posix()
                if relp not in arquivos_usados:
                    erros.append(f'{relp}: arquivo em docs/ fora do catálogo (data/documentos.json)')
    servidos, modo = arquivos_servidos(raiz)
    for relp in sorted(servidos):
        if Path(relp).suffix.lower() in EXT_DOCUMENTO and not relp.startswith('docs/'):
            erros.append(f'{relp}: documento fora de docs/ seria publicado ({modo})')

    # ---------------- PDFs sem texto selecionável ----------------
    if conferir_pdf and arquivos_usados:
        leitor = None
        try:
            import fitz  # PyMuPDF
            leitor = 'fitz'
        except ImportError:
            try:
                import pypdf  # noqa: F401
                leitor = 'pypdf'
            except ImportError:
                avisos.append('PDFs: PyMuPDF/pypdf não instalados; texto selecionável não conferido')
        sem_texto = []
        for arq in sorted(arquivos_usados):
            p = raiz / arq
            if not p.exists() or p.suffix.lower() != '.pdf':
                continue
            try:
                if leitor == 'fitz':
                    with fitz.open(p) as doc:
                        n = sum(len(pg.get_text().strip()) for pg in doc)
                elif leitor == 'pypdf':
                    import pypdf
                    n = sum(len((pg.extract_text() or '').strip()) for pg in pypdf.PdfReader(str(p)).pages)
                else:
                    break
            except Exception as ex:  # noqa: BLE001
                erros.append(f'{arq}: PDF não pôde ser aberto ({type(ex).__name__})')
                continue
            if n < 20:
                sem_texto.append(arq)
        if sem_texto:
            avisos.append(f'{len(sem_texto)} PDF(s) sem texto selecionável (digitalização; dificulta leitores de tela): ' + ', '.join(sem_texto))

    # ---------------- calendario.ics ----------------
    ics_p = raiz / 'calendario.ics'
    if not ics_p.exists():
        avisos.append('calendario.ics: ausente (rode tools/gerar_ics.py)')
    else:
        ics = ics_p.read_bytes().decode('utf-8', errors='replace')
        linhas = ics.replace('\r\n ', '').replace('\r\n', '\n').split('\n')
        if not ics.startswith('BEGIN:VCALENDAR') or 'END:VCALENDAR' not in ics:
            erros.append('calendario.ics: estrutura VCALENDAR ausente')
        if linhas.count('BEGIN:VEVENT') != linhas.count('END:VEVENT'):
            erros.append('calendario.ics: BEGIN:VEVENT e END:VEVENT em número diferente')
        uids = [l[4:] for l in linhas if l.startswith('UID:')]
        if len(uids) != len(set(uids)):
            erros.append('calendario.ics: UID repetido')
        if len(uids) != linhas.count('BEGIN:VEVENT'):
            erros.append('calendario.ics: evento sem UID')
        for l in linhas:
            m = re.match(r'DTSTART(?:;VALUE=DATE)?:(\d{8})(T\d{6}Z?)?$', l)
            if l.startswith('DTSTART') and not m:
                erros.append(f'calendario.ics: DTSTART malformado: {l}')
            elif m and not data_valida(f'{m.group(1)[:4]}-{m.group(1)[4:6]}-{m.group(1)[6:]}'):
                erros.append(f'calendario.ics: data inexistente: {l}')
            if l.startswith('DTSTAMP') and not re.fullmatch(r'DTSTAMP:\d{8}T\d{6}Z', l):
                erros.append(f'calendario.ics: DTSTAMP malformado: {l}')
        if ics_mod and reun:
            try:
                esperado = ics_mod.gerar(raiz)
                atual = ics.replace('\r\n', '\n').replace('\n', '\r\n')

                def sem_stamp(t):
                    return re.sub(r'DTSTAMP:[^\r\n]*', 'DTSTAMP', t)
                if sem_stamp(esperado) != sem_stamp(atual):
                    erros.append('calendario.ics: diferente do gerado a partir de data/reunioes.json (rode tools/gerar_ics.py)')
                elif esperado != atual:
                    avisos.append('calendario.ics: só o DTSTAMP difere do registro de atualização (rode tools/gerar_ics.py depois de registrar_atualizacao)')
            except Exception as ex:  # noqa: BLE001
                erros.append(f'tools/gerar_ics.py: erro ao gerar ({type(ex).__name__}: {ex})')

    # ---------------- Sitemap ----------------
    sm = raiz / 'sitemap.xml'
    if sm.exists():
        for loc in re.findall(r'<loc>([^<]+)</loc>', sm.read_text(encoding='utf-8')):
            url_cfg = str((cfg or {}).get('url_site') or '').strip().rstrip('/') if isinstance(cfg, dict) else ''
            if loc.startswith('{{URL_SITE}}'):
                caminho = loc[len('{{URL_SITE}}'):].lstrip('/')
            elif url_cfg and loc.startswith(url_cfg):
                caminho = loc[len(url_cfg):].lstrip('/')
            else:
                erros.append(f'sitemap.xml: base diferente de site.config.json url_site: {loc} (rode tools/gerar_sitemap.py)')
                continue
            alvo = raiz / caminho / 'index.html' if not caminho.endswith('.html') else raiz / caminho
            if not alvo.exists():
                erros.append(f'sitemap.xml: entrada sem página: {loc}')
    else:
        avisos.append('sitemap.xml: ausente (rode tools/gerar_sitemap.py)')

    # ---------------- .gitignore ----------------
    gi = raiz / '.gitignore'
    if gi.exists():
        t = gi.read_text(encoding='utf-8')
        for pasta in ('_relatorios/', '_amostra/', '_revisao/'):
            if pasta not in t:
                avisos.append(f'.gitignore: falta {pasta}')

    # ---------------- Resultado ----------------
    print(f'Pasta verificada: {raiz}')
    print(f'Páginas HTML: {paginas} | documentos: {len(ids_vistos)} | reuniões: {len(reun)} | conselheiros: {len(cons)}')
    for a in avisos:
        print('AVISO:', a)
    for e in erros:
        print('ERRO: ', e)
    print(f'Resumo: {len(erros)} erro(s), {len(avisos)} aviso(s).')
    sys.exit(1 if erros else 0)


if __name__ == '__main__':
    main()
