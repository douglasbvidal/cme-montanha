# -*- coding: utf-8 -*-
"""Gera sitemap.xml (e a linha Sitemap do robots.txt) a partir de site.config.json.

Uso:  python tools/gerar_sitemap.py [pasta_do_site]
Se "url_site" estiver vazio em site.config.json, o sitemap usa o marcador {{URL_SITE}}
(e o robots.txt fica sem a linha Sitemap). Somente biblioteca padrão.
"""
import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

EXCLUIR = {'_amostra', '_relatorios', 'tools', '.github', '.git', 'assets', 'data', 'docs', '_site'}
MARCADOR = '{{URL_SITE}}'


def main():
    raiz = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
    cfg = {}
    try:
        cfg = json.loads((raiz / 'site.config.json').read_text(encoding='utf-8'))
    except (OSError, ValueError) as erro:
        print(f'Aviso: não foi possível ler site.config.json ({erro}); usando marcador.')
    url = str(cfg.get('url_site') or '').strip()
    base = (url.rstrip('/') + '/') if url.startswith(('https://', 'http://')) else MARCADOR + '/'

    paginas = []
    if (raiz / 'index.html').exists():
        paginas.append('')
    for d in sorted(p for p in raiz.iterdir() if p.is_dir() and p.name not in EXCLUIR and not p.name.startswith('.')):
        if (d / 'index.html').exists():
            paginas.append(d.name + '/')

    linhas = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p in paginas:
        prioridade = '1.0' if p == '' else '0.7'
        linhas.append(f'  <url><loc>{escape(base + p)}</loc><priority>{prioridade}</priority></url>')
    linhas.append('</urlset>')
    (raiz / 'sitemap.xml').write_text('\n'.join(linhas) + '\n', encoding='utf-8', newline='\n')

    robots = 'User-agent: *\nAllow: /\n'
    if not base.startswith(MARCADOR):
        robots += f'\nSitemap: {base}sitemap.xml\n'
    (raiz / 'robots.txt').write_text(robots, encoding='utf-8', newline='\n')
    print(f'sitemap.xml: {len(paginas)} páginas; base = {base}')


if __name__ == '__main__':
    main()
