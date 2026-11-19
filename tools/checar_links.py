# -*- coding: utf-8 -*-
"""Checa links relativos, recursos externos e coerência dos dados do site do CME Montanha.

Uso:  python tools/checar_links.py [pasta_do_site] [--hash]
  pasta_do_site  padrão: a pasta acima de tools/ (o site real). Ex.: _amostra para os dados de teste.
  --hash         recalcula o SHA-256 de cada PDF e compara com data/documentos.json.

Saída: lista de ERROS (quebram a publicação) e AVISOS. Código de saída 1 se houver erro.
Somente biblioteca padrão.
"""
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

IGNORAR_PASTAS = {'_amostra', '_relatorios', 'tools', '.git', '.github', '_site', 'node_modules'}
CATEGORIAS = {'legislacao', 'regimento', 'resolucoes', 'pareceres', 'oficios', 'pautas', 'atas', 'outros'}
STATUS_DOC = {'vigente', 'assinado', 'enviado', 'em_estudo', 'referencia'}
STATUS_REUNIAO = {'realizada', 'prevista', 'convocada', 'cancelada', 'sem_quorum', 'sem_registro'}
ESQUEMAS_EXTERNOS = ('http:', 'https:', 'mailto:', 'tel:', 'webcal:', 'data:', 'javascript:')


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


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    conferir_hash = '--hash' in sys.argv
    raiz = Path(args[0]).resolve() if args else Path(__file__).resolve().parent.parent
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

    # ---------------- CSS e JS ----------------
    for css in raiz.glob('assets/**/*.css'):
        for m in re.finditer(r'url\(\s*["\']?([^"\')]+)', css.read_text(encoding='utf-8')):
            u = m.group(1)
            if u.startswith(('http:', 'https:', '//')):
                erros.append(f'{css.relative_to(raiz)}: recurso externo em CSS: {u}')
            elif u.startswith('/'):
                erros.append(f'{css.relative_to(raiz)}: caminho absoluto em CSS: {u}')
            elif not u.startswith('data:') and not (css.parent / u).exists():
                erros.append(f'{css.relative_to(raiz)}: url() inexistente: {u}')
        if '@import' in css.read_text(encoding='utf-8'):
            avisos.append(f'{css.relative_to(raiz)}: contém @import')
    for js in raiz.glob('assets/**/*.js'):
        t = js.read_text(encoding='utf-8')
        for m in re.finditer(r"carregar\('([^']+)'\)", t):
            if not (raiz / m.group(1)).exists():
                avisos.append(f'{js.relative_to(raiz)}: arquivo de dados ainda inexistente: {m.group(1)} (o site mostra estado vazio)')
        for m in re.finditer(r"['\"](https?://[^'\"]+)['\"]", t):
            if 'github.com' not in m.group(1) and 'giscus.app' not in m.group(1):
                avisos.append(f'{js.relative_to(raiz)}: URL externa no código: {m.group(1)}')

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

    docs = ler_json('data/documentos.json')
    ids = set()
    if docs is not None:
        if not isinstance(docs, list):
            erros.append('data/documentos.json: deveria ser uma lista')
            docs = []
        for i, d in enumerate(docs):
            ref = f'data/documentos.json[{i}]'
            if not isinstance(d, dict):
                erros.append(f'{ref}: item não é objeto')
                continue
            did = d.get('id')
            if did in (None, ''):
                erros.append(f'{ref}: sem id')
            elif str(did) in ids:
                erros.append(f'{ref}: id repetido {did}')
            ids.add(str(did))
            if d.get('categoria') not in CATEGORIAS:
                erros.append(f'{ref}: categoria inválida {d.get("categoria")!r}')
            if d.get('status') not in STATUS_DOC:
                avisos.append(f'{ref}: status fora do esquema {d.get("status")!r}')
            dt = d.get('data')
            if dt is not None and not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(dt)):
                erros.append(f'{ref}: data fora do formato AAAA-MM-DD: {dt!r}')
            arq = str(d.get('arquivo') or '').replace('\\', '/')
            if d.get('externo') is True:
                u = str(d.get('url') or '')
                if not re.fullmatch(r'https?://[^\s"\'<>]+', u):
                    erros.append(f'{ref}: documento externo sem url válida')
                elif u.startswith('http://'):
                    avisos.append(f'{ref}: url externa em http:// (prefira https://): {u}')
                if arq:
                    avisos.append(f'{ref}: documento externo com "arquivo" preenchido (o site usa só a url)')
            elif not arq.startswith('docs/') or '..' in arq:
                erros.append(f'{ref}: arquivo deve estar em docs/: {arq!r}')
            else:
                p = raiz / arq
                if not p.exists():
                    erros.append(f'{ref}: PDF inexistente: {arq}')
                elif conferir_hash and d.get('sha256'):
                    h = hashlib.sha256(p.read_bytes()).hexdigest()
                    if h != str(d['sha256']).lower():
                        erros.append(f'{ref}: SHA-256 não confere para {arq}')
            sha = str(d.get('sha256') or '')
            if sha and not re.fullmatch(r'[0-9a-fA-F]{64}', sha):
                erros.append(f'{ref}: sha256 com formato inválido')
            fonte = str(d.get('fonte_original') or '')
            if re.search(r'^[A-Za-z]:[\\/]|[\\/]Users[\\/]|OneDrive', fonte, re.I):
                avisos.append(f'{ref}: fonte_original parece caminho local (o site não a exibe; o JSON público a expõe)')

    reun = ler_json('data/reunioes.json')
    if isinstance(reun, list):
        for i, r in enumerate(reun):
            ref = f'data/reunioes.json[{i}]'
            if not isinstance(r, dict):
                erros.append(f'{ref}: item não é objeto')
                continue
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(r.get('data'))):
                erros.append(f'{ref}: data inválida {r.get("data")!r}')
            if r.get('status') not in STATUS_REUNIAO:
                avisos.append(f'{ref}: status fora do esquema {r.get("status")!r}')
            for k in ('pauta_id', 'ata_id'):
                v = r.get(k)
                if v not in (None, '') and str(v) not in ids:
                    erros.append(f'{ref}: {k}={v!r} não existe em documentos.json')

    cons = ler_json('data/conselheiros.json')
    if cons is not None and not isinstance(cons, list):
        erros.append('data/conselheiros.json: deveria ser uma lista')
    cont = ler_json('data/conteudo.json')
    if cont is not None and not isinstance(cont, dict):
        erros.append('data/conteudo.json: deveria ser um objeto')
    if not (raiz / 'calendario.ics').exists():
        avisos.append('calendario.ics: ausente')
    else:
        ics = (raiz / 'calendario.ics').read_text(encoding='utf-8', errors='replace')
        if 'BEGIN:VCALENDAR' not in ics or 'END:VCALENDAR' not in ics:
            erros.append('calendario.ics: estrutura VCALENDAR ausente')

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

    # ---------------- Resultado ----------------
    print(f'Pasta verificada: {raiz}')
    print(f'Páginas HTML: {paginas} | documentos: {len(ids)}')
    for a in avisos:
        print('AVISO:', a)
    for e in erros:
        print('ERRO: ', e)
    print(f'Resumo: {len(erros)} erro(s), {len(avisos)} aviso(s).')
    sys.exit(1 if erros else 0)


if __name__ == '__main__':
    main()
