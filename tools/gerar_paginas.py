# -*- coding: utf-8 -*-
"""Gera as páginas HTML estáticas do site do CME Montanha a partir de um molde comum.

Uso (opcional; só é necessário ao mudar cabeçalho, menu, rodapé ou textos fixos):
    python tools/gerar_paginas.py

As páginas geradas são arquivos estáticos versionados; o GitHub Pages não executa este script.
Textos aqui apenas descrevem como usar o site; fatos institucionais vêm de data/*.json e
site.config.json. Somente biblioteca padrão do Python.
"""
from pathlib import Path
import html

RAIZ = Path(__file__).resolve().parent.parent

LOGO = (
    '<svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">'
    '<rect class="bm-bg" width="48" height="48" rx="13"/>'
    '<path class="bm-fg" d="M24 8 39 16H9z"/>'
    '<path class="bm-fg" d="M10 20.5c4.6-1.6 9.4-1 14 1.6 4.6-2.6 9.4-3.2 14-1.6V36c-4.6-1.6-9.4-1-14 1.6-4.6-2.6-9.4-3.2-14-1.6z"/>'
    '<path class="bm-line" d="M24 22.5v14" fill="none" stroke-width="1.6"/></svg>'
)

ICONES = {
    'busca': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    'lua': '<svg class="icon icon-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    'sol': '<svg class="icon icon-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    'menu': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    'doc': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    'balanca': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/></svg>',
    'livro': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/></svg>',
    'calendario': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    'pessoas': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>',
    'escudo': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    'carta': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    'conversa': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
    'info': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    'externo': '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    'baixar':'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
}

# (slug, rótulo) — ordem do menu principal
MENU = [
    ('', 'Início'), ('sobre', 'Sobre'), ('legislacao', 'Legislação'), ('regimento', 'Regimento'),
    ('resolucoes-pareceres', 'Resoluções e pareceres'), ('oficios', 'Ofícios'), ('reunioes', 'Reuniões'),
    ('conselheiros', 'Conselheiros'), ('transparencia', 'Transparência'), ('mural', 'Mural'), ('contato', 'Contato'),
]

RODAPE_GRUPOS = [
    ('Documentos', [('legislacao', 'Legislação'), ('regimento', 'Regimento interno'), ('resolucoes-pareceres', 'Resoluções e pareceres'),
                    ('oficios', 'Ofícios'), ('reunioes', 'Pautas, atas e calendário')]),
    ('O Conselho', [('sobre', 'Sobre o CME'), ('conselheiros', 'Conselheiros'), ('transparencia', 'Transparência'),
                    ('#ics', 'Calendário (.ics)')]),
    ('Participação', [('contato', 'Fale com o CME'), ('mural', 'Mural de discussões'), ('faq', 'Perguntas frequentes'),
                      ('glossario', 'Glossário'), ('links', 'Links úteis')]),
    ('Este site', [('privacidade', 'Privacidade (LGPD)'), ('acessibilidade', 'Acessibilidade'), ('busca', 'Busca')]),
]

RODAPE_FRASE = ('Conselho Municipal de Educação de Montanha — ES. Atos oficiais publicados para consulta; '
                'o documento assinado prevalece.')


def e(s):
    return html.escape(s, quote=True)


def href(r, slug):
    if slug == '#ics':
        return r + 'calendario.ics'
    return r + (slug + '/' if slug else '') + 'index.html'


def cabecalho(r, atual):
    itens = []
    for slug, rot in MENU:
        cur = ' aria-current="page"' if slug == atual else ''
        itens.append(f'<li><a href="{href(r, slug)}"{cur}>{e(rot)}</a></li>')
    return f'''<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
<div class="topline"><div class="wrap"><span>Conselho Municipal de Educação de Montanha — Espírito Santo</span><span>Portal de consulta pública</span></div></div>
<header class="site-header">
  <div class="wrap nav-wrap">
    <a class="brand" href="{href(r, '')}">{LOGO}<span><strong>CME Montanha</strong><small>Conselho Municipal de Educação</small></span></a>
    <div class="header-tools">
      <a class="search-button" href="{r}busca/index.html" data-open-search aria-label="Buscar no site (atalho: tecla barra)">{ICONES['busca']}<span class="label">Buscar</span><kbd aria-hidden="true">/</kbd></a>
      <button class="icon-button theme-toggle" type="button" data-theme-toggle aria-pressed="false" aria-label="Alternar tema claro ou escuro">{ICONES['lua']}{ICONES['sol']}</button>
      <button class="icon-button menu-button" id="menu-button" type="button" aria-expanded="false" aria-controls="nav-menu">{ICONES['menu']}<span class="sr-only">Menu</span></button>
    </div>
  </div>
  <nav class="nav-bar" aria-label="Principal"><div class="wrap"><ul class="nav-links" id="nav-menu">
    {''.join(itens)}
  </ul></div></nav>
</header>'''


def rodape(r):
    grupos = []
    for titulo, links in RODAPE_GRUPOS:
        a = ''.join(f'<a href="{href(r, s)}">{e(t)}</a>' for s, t in links)
        grupos.append(f'<div><strong>{e(titulo)}</strong>{a}</div>')
    return f'''<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <div>
        <a class="brand" href="{href(r, '')}">{LOGO}<span><strong>CME Montanha</strong><small>Conselho Municipal de Educação</small></span></a>
        <p class="tiny">Portal de consulta aos atos, reuniões e documentos públicos do Conselho. Sem cookies e sem rastreadores.</p>
      </div>
      <div class="footer-links">{''.join(grupos)}</div>
    </div>
    <div class="footer-bottom">
      <p>{e(RODAPE_FRASE)}</p>
      <p>Documentos atualizados em: <span data-atualizacao>—</span></p>
    </div>
  </div>
</footer>
<dialog class="search-dialog" id="search-dialog" aria-labelledby="search-dialog-t">
  <div class="dialog-top"><h2 id="search-dialog-t">Buscar no site</h2><button type="button" class="icon-button" data-close-search aria-label="Fechar busca">✕</button></div>
  <form class="search-field" role="search" action="{r}busca/index.html" method="get">
    <label class="sr-only" for="dlg-q">Termo de busca</label>
    <input type="search" id="dlg-q" name="q" autocomplete="off" placeholder="Ex.: resolução, ata, regimento">
    <button class="btn small" type="submit">Ver todos</button>
  </form>
  <p class="tiny" data-search-status role="status" aria-live="polite"></p>
  <ul class="search-results"></ul>
</dialog>
<button class="back-top" id="back-top" type="button" aria-label="Voltar ao topo" hidden>↑</button>'''


def migalhas(r, rotulo):
    if rotulo is None:
        return ''
    return (f'<nav class="breadcrumbs wrap" aria-label="Você está em"><ol>'
            f'<li><a href="{href(r, "")}">Início</a></li><li><span aria-current="page">{e(rotulo)}</span></li></ol></nav>')


def cabeca_pagina(eyebrow, h1, lead):
    return (f'<header class="wrap page-head"><p class="eyebrow">{e(eyebrow)}</p><h1>{e(h1)}</h1>'
            f'<p class="lead">{lead}</p></header>')


SCRIPT_TEMA = ("<script>(function(){try{var t=localStorage.getItem('cme-tema');"
               "if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>")

# Para 404.html: no GitHub Pages a página de erro é servida em qualquer caminho; define <base>
# em tempo de execução (raiz do project site), sem caminho absoluto fixo no código.
SCRIPT_BASE_404 = ("<script>(function(){if(location.protocol==='file:')return;var b='/';"
                   "if(/\\.github\\.io$/i.test(location.hostname)){var s=location.pathname.split('/')[1];if(s)b='/'+s+'/';}"
                   "var el=document.createElement('base');el.href=b;document.head.appendChild(el);})();</script>")


def documento(slug, pid, titulo, descricao, migalha, corpo, scripts, profundidade=None, extra_head=''):
    r = '../' if slug else ''
    if profundidade is not None:
        r = profundidade
    titulo_completo = titulo if pid == 'inicio' else f'{titulo} · CME Montanha'
    js = ''.join(f'<script src="{r}assets/js/{s}.js" defer></script>' for s in ['comum', 'busca'] + scripts)
    return f'''<!doctype html>
<html lang="pt-BR" class="no-js">
<head>
<meta charset="utf-8">
{extra_head}<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo_completo)}</title>
<meta name="description" content="{e(descricao)}">
<meta name="theme-color" content="#0b5265">
<meta name="color-scheme" content="light dark">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="CME Montanha">
<meta property="og:title" content="{e(titulo_completo)}">
<meta property="og:description" content="{e(descricao)}">
<link rel="icon" href="{r}assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{r}assets/css/site.css">
{SCRIPT_TEMA}
{js}
</head>
<body data-raiz="{r}" data-pagina="{pid}">
{cabecalho(r, slug if pid != '404' else None)}
<main id="conteudo">
{migalhas(r, migalha)}
{corpo}
</main>
{rodape(r)}
</body>
</html>
'''


def cartao(r, slug, icone, titulo, texto):
    return (f'<a class="source-card" href="{href(r, slug)}"><h3><span class="source-icon">{ICONES[icone]}</span>{e(titulo)}</h3>'
            f'<p>{e(texto)}</p></a>')


def lista_docs(cats, vazio='Nenhum documento publicado nesta seção ainda.', prefixo=''):
    p = f' data-prefixo="{prefixo}"' if prefixo else ''
    return (f'<div data-lista-documentos="{cats}" data-vazio="{e(vazio)}"{p}>'
            f'<noscript><div class="empty-state"><p>Ative o JavaScript para ver e filtrar a lista de documentos.</p></div></noscript></div>')


# Endereços oficiais indicados pelo Conselho (decisão registrada em 18/11/2026).
FONTES_OFICIAIS = [
    ('Portal da Transparência de Montanha — CME', 'https://montanha-es.portaltp.com.br/consultas/documentos.aspx?id=490',
     'Documentos do Conselho Municipal de Educação publicados pela Prefeitura.'),
    ('Portal da Transparência de Montanha — Leis', 'https://montanha-es.portaltp.com.br/consultas/documentos.aspx?id=82',
     'Leis municipais publicadas no Portal da Transparência.'),
    ('Portal da Transparência de Montanha — Decretos', 'https://montanha-es.portaltp.com.br/consultas/documentos.aspx?id=16',
     'Decretos municipais publicados no Portal da Transparência.'),
    ('Legislação compilada de Montanha', 'https://montanha.legislacaocompilada.com.br/',
     'Consulta à legislação municipal compilada.'),
    ('Diário Oficial dos Municípios (DOM/ES)', 'https://ioes.dio.es.gov.br/dom',
     'Publicações oficiais dos municípios do Espírito Santo.'),
]


def fontes_oficiais():
    cards = ''.join(
        f'<a class="source-card" href="{e(u)}" target="_blank" rel="noopener"><h3><span class="source-icon">{ICONES["externo"]}</span>{e(t)}</h3>'
        f'<p>{e(d)}</p><p class="tiny">Site oficial externo <span aria-hidden="true">↗</span><span class="sr-only">(abre em nova aba)</span></p></a>'
        for t, u, d in FONTES_OFICIAIS)
    return f'<div class="grid cols-3">{cards}</div>'


PAGINAS = []


def pagina(slug, pid, titulo, descricao, migalha, corpo, scripts=()):
    PAGINAS.append((slug, pid, titulo, descricao, migalha, corpo, list(scripts)))


# ---------------------------------------------------------------- Início
r0 = ''
pagina('', 'inicio', 'CME Montanha — Conselho Municipal de Educação de Montanha (ES)',
       'Portal de consulta pública do Conselho Municipal de Educação de Montanha (ES): legislação, regimento, resoluções, pareceres, ofícios, pautas, atas e calendário de reuniões.',
       None, f'''
<section class="wrap hero" aria-labelledby="hero-t">
  <div>
    <p class="eyebrow">Conselho Municipal de Educação · Montanha (ES)</p>
    <h1 id="hero-t">Atos, reuniões e documentos públicos do CME Montanha</h1>
    <p class="lead">Consulte a legislação, o regimento, as resoluções, os pareceres, os ofícios, as pautas e as atas publicados pelo Conselho, acompanhe o calendário de reuniões e fale com o CME.</p>
    <form class="hero-search" role="search" action="busca/index.html" method="get">
      <label class="sr-only" for="home-q">Buscar documentos e conteúdos</label>
      <input type="search" id="home-q" name="q" placeholder="Buscar por título, número ou assunto">
      <button class="btn" type="submit">{ICONES['busca']}Buscar</button>
    </form>
    <p class="tiny">Dica: em qualquer página, pressione <kbd>/</kbd> para abrir a busca.</p>
  </div>
  <aside class="hero-card" aria-labelledby="prox-t">
    <h2 id="prox-t">{ICONES['calendario']} Próximas reuniões</h2>
    <div id="home-reunioes"><p class="tiny">Carregando…</p></div>
    <p style="margin:12px 0 0"><a class="text-link" href="reunioes/index.html">Ver calendário completo</a></p>
  </aside>
</section>
<section class="soft-section" aria-labelledby="atalhos-t"><div class="wrap">
  <div class="section-title"><h2 id="atalhos-t">Acesso rápido</h2></div>
  <div class="grid cols-3">
    {cartao(r0, 'legislacao', 'balanca', 'Legislação', 'Leis e atos normativos que tratam do Conselho e da educação municipal.')}
    {cartao(r0, 'regimento', 'livro', 'Regimento interno', 'Regras de funcionamento do Conselho e situação do regimento.')}
    {cartao(r0, 'resolucoes-pareceres', 'doc', 'Resoluções e pareceres', 'Deliberações e manifestações do Conselho.')}
    {cartao(r0, 'oficios', 'carta', 'Ofícios', 'Correspondências e encaminhamentos oficiais já enviados.')}
    {cartao(r0, 'reunioes', 'calendario', 'Reuniões', 'Pautas, atas e calendário de reuniões, com arquivo para agenda.')}
    {cartao(r0, 'conselheiros', 'pessoas', 'Conselheiros', 'Composição do Conselho conforme ato oficial.')}
    {cartao(r0, 'transparencia', 'escudo', 'Transparência', 'Informações públicas, números do acervo e dados abertos.')}
    {cartao(r0, 'contato', 'conversa', 'Fale com o CME', 'Dúvidas, sugestões e pedidos de informação.')}
    {cartao(r0, 'faq', 'info', 'Perguntas frequentes', 'Respostas rápidas sobre o Conselho e este site.')}
  </div>
</div></section>
<section class="section" aria-labelledby="ult-t"><div class="wrap">
  <div class="section-title"><h2 id="ult-t">Últimos documentos publicados</h2><a class="text-link" href="busca/index.html">Buscar em todos os documentos</a></div>
  <div id="home-documentos"><p class="tiny">Carregando…</p></div>
</div></section>
<section class="section" aria-labelledby="como-t"><div class="wrap">
  <div class="panel">
    <h2 id="como-t">Como usar este site</h2>
    <ul>
      <li>Cada documento traz a situação (vigente, assinado, enviado, em estudo ou referência), a data e o link para baixar o PDF.</li>
      <li>Em “Verificar integridade”, o código SHA-256 permite conferir se o arquivo baixado é idêntico ao publicado.</li>
      <li>Este site é um meio de consulta: em caso de divergência, prevalece o documento oficial assinado.</li>
    </ul>
  </div>
</div></section>''', ['documentos', 'reunioes', 'paginas'])

# ---------------------------------------------------------------- Sobre
pagina('sobre', 'sobre', 'Sobre o Conselho',
       'O que é o Conselho Municipal de Educação de Montanha (ES): finalidade, natureza, composição, mandato e competências, com indicação das fontes.',
       'Sobre', cabeca_pagina('O Conselho', 'Sobre o CME Montanha',
                              'Finalidade, natureza, composição, mandato e competências do Conselho, com a fonte de cada informação.') +
       '<div class="wrap"><div id="sobre-conteudo" class="prose"><p class="tiny">Carregando…</p></div>'
       '<p class="tiny" style="margin-top:18px">Veja também: <a href="../legislacao/index.html">legislação</a> · <a href="../regimento/index.html">regimento interno</a> · <a href="../conselheiros/index.html">conselheiros</a>.</p></div>',
       ['paginas'])

# ---------------------------------------------------------------- Listagens
pagina('legislacao', 'legislacao', 'Legislação',
       'Leis e atos normativos relacionados ao Conselho Municipal de Educação de Montanha (ES), com PDF para download e verificação de integridade.',
       'Legislação', cabeca_pagina('Documentos', 'Legislação',
                                   'Leis e atos normativos relacionados ao Conselho e à educação municipal. Atos de outros órgãos são indicados pelo link oficial; o Conselho não os hospeda.') +
       f'<div class="wrap">{lista_docs("legislacao")}'
       f'<section class="section" aria-labelledby="oficiais-t"><h2 id="oficiais-t">Consultar nas fontes oficiais</h2>'
       f'<p>A versão oficial e atualizada das leis e decretos municipais deve ser conferida nestes endereços:</p>{fontes_oficiais()}</section></div>',
       ['documentos'])

pagina('regimento', 'regimento', 'Regimento interno',
       'Regimento interno do Conselho Municipal de Educação de Montanha (ES), situação de homologação e documentos relacionados.',
       'Regimento', cabeca_pagina('Documentos', 'Regimento interno',
                                  'Regras de funcionamento do Conselho e documentos relacionados. A situação informada abaixo vem dos registros publicados.') +
       f'<div class="wrap"><div id="regimento-aviso"></div>{lista_docs("regimento")}</div>', ['documentos', 'paginas'])

pagina('resolucoes-pareceres', 'resolucoes-pareceres', 'Resoluções e pareceres',
       'Resoluções e pareceres do Conselho Municipal de Educação de Montanha (ES), com filtros por ano, tipo e situação.',
       'Resoluções e pareceres', cabeca_pagina('Documentos', 'Resoluções e pareceres',
                                               'Deliberações e manifestações do Conselho. Use o filtro “Tipo” para separar resoluções de pareceres.') +
       f'<div class="wrap">{lista_docs("resolucoes,pareceres")}</div>', ['documentos'])

pagina('oficios', 'oficios', 'Ofícios',
       'Ofícios e encaminhamentos do Conselho Municipal de Educação de Montanha (ES), com PDF para download.',
       'Ofícios', cabeca_pagina('Documentos', 'Ofícios e encaminhamentos',
                                'Correspondências oficiais do Conselho. A ficha de cada ofício indica quando a cópia não tem assinatura; dados pessoais de terceiros aparecem com tarja.') +
       f'<div class="wrap">{lista_docs("oficios")}</div>', ['documentos'])

# ---------------------------------------------------------------- Reuniões
pagina('reunioes', 'reunioes', 'Reuniões: pautas, atas e calendário',
       'Calendário de reuniões do Conselho Municipal de Educação de Montanha (ES), pautas, atas aprovadas e arquivo .ics para agenda.',
       'Reuniões', cabeca_pagina('Reuniões', 'Pautas, atas e calendário',
                                 'Acompanhe as reuniões do Conselho. As atas são publicadas depois de aprovadas.') + f'''
<div class="wrap" data-abas>
  <div class="tabs" role="tablist" aria-label="Seções de reuniões">
    <button type="button" role="tab" id="tab-pautas" aria-controls="painel-pautas" aria-selected="false" data-aba="pautas">Pautas</button>
    <button type="button" role="tab" id="tab-atas" aria-controls="painel-atas" aria-selected="false" data-aba="atas">Atas</button>
    <button type="button" role="tab" id="tab-calendario" aria-controls="painel-calendario" aria-selected="true" data-aba="calendario" data-padrao="true">Calendário</button>
  </div>
  <section class="tab-panel" role="tabpanel" id="painel-pautas" aria-labelledby="tab-pautas" tabindex="0">
    <h2 class="sr-only">Pautas</h2>
    {lista_docs("pautas", "Nenhuma pauta publicada ainda.", "pa")}
  </section>
  <section class="tab-panel" role="tabpanel" id="painel-atas" aria-labelledby="tab-atas" tabindex="0">
    <h2 class="sr-only">Atas</h2>
    <div class="notice" role="note"><p>As atas serão publicadas após aprovação pelo plenário.</p></div>
    {lista_docs("atas", "Nenhuma ata aprovada publicada ainda.", "at")}
  </section>
  <section class="tab-panel" role="tabpanel" id="painel-calendario" aria-labelledby="tab-calendario" tabindex="0">
    <h2 class="sr-only">Calendário</h2>
    <div class="actions" id="ics-acoes" style="margin-top:0;margin-bottom:18px">
      <a class="btn" href="../calendario.ics" download>{ICONES['baixar']}<span>Baixar calendário (.ics)</span></a>
    </div>
    <p class="tiny">O arquivo .ics pode ser importado no Outlook, Google Agenda ou no calendário do celular.</p>
    <div class="grid" style="gap:28px">
      <div id="calendario-mensal" class="panel"><p class="tiny">Carregando…</p></div>
      <div id="lista-reunioes"><p class="tiny">Carregando…</p></div>
    </div>
  </section>
</div>''', ['documentos', 'reunioes'])

# ---------------------------------------------------------------- Conselheiros
pagina('conselheiros', 'conselheiros', 'Conselheiros',
       'Composição do Conselho Municipal de Educação de Montanha (ES): conselheiros titulares e suplentes por segmento, conforme ato oficial.',
       'Conselheiros', cabeca_pagina('O Conselho', 'Conselheiros',
                                     'Composição do Conselho por segmento, conforme o ato oficial de nomeação. Contatos pessoais não são publicados.') +
       '<div class="wrap"><div id="lista-conselheiros"><p class="tiny">Carregando…</p></div></div>', ['paginas'])

# ---------------------------------------------------------------- Transparência
pagina('transparencia', 'transparencia', 'Transparência',
       'Transparência do Conselho Municipal de Educação de Montanha (ES): informações públicas, números do acervo, dados abertos e outros documentos.',
       'Transparência', cabeca_pagina('O Conselho', 'Transparência',
                                      'Informações públicas sobre o Conselho, números do acervo publicado e dados abertos deste site.') + f'''
<div class="wrap">
  <div id="transparencia-conteudo" class="prose"><p class="tiny">Carregando…</p></div>
  <section class="section" aria-labelledby="num-t"><h2 id="num-t">Números do acervo publicado</h2><div id="transparencia-numeros"><p class="tiny">Carregando…</p></div></section>
  <section class="panel" aria-labelledby="dados-t">
    <h2 id="dados-t">Dados abertos deste site</h2>
    <p>Os índices usados pelo site podem ser baixados em formato aberto:</p>
    <ul>
      <li><a href="../data/documentos.json">Índice de documentos (JSON)</a></li>
      <li><a href="../data/reunioes.json">Reuniões (JSON)</a></li>
      <li><a href="../data/conselheiros.json">Composição (JSON)</a></li>
      <li><a href="../calendario.ics">Calendário de reuniões (iCalendar .ics)</a></li>
    </ul>
    <p class="tiny">Para pedir informação que não esteja publicada, use a página <a href="../contato/index.html">Fale com o CME</a>.</p>
  </section>
  <section class="section" aria-labelledby="outros-t"><h2 id="outros-t">Outros documentos</h2>{lista_docs("outros", "Nenhum outro documento publicado ainda.", "ou")}</section>
</div>''', ['documentos', 'paginas'])

# ---------------------------------------------------------------- Contato
pagina('contato', 'contato', 'Fale com o CME',
       'Canais públicos de contato do Conselho Municipal de Educação de Montanha (ES) e formulário que prepara uma mensagem de e-mail.',
       'Contato', cabeca_pagina('Participação', 'Fale com o CME',
                                'Dúvidas, sugestões e pedidos de informação. Este site não guarda mensagens: o formulário apenas prepara um e-mail no seu próprio programa.') + '''
<div class="wrap grid cols-2" style="align-items:start">
  <section class="panel" aria-labelledby="canais-t">
    <h2 id="canais-t">Canais oficiais</h2>
    <div id="contato-dados"><p class="tiny">Carregando…</p></div>
    <p class="tiny" id="contato-discussoes" hidden>Perguntas de interesse geral também podem ser feitas no <a href="../mural/index.html">mural público de discussões</a> (exige conta no GitHub).</p>
  </section>
  <section class="panel" aria-labelledby="form-t">
    <h2 id="form-t">Escrever mensagem</h2>
    <form id="form-contato" class="form-grid" novalidate>
      <div class="field"><label for="c-nome">Seu nome (opcional)</label><input type="text" id="c-nome" autocomplete="name"></div>
      <div class="field"><label for="c-assunto">Assunto</label>
        <select id="c-assunto">
          <option>Dúvida</option><option>Sugestão</option><option>Pedido de informação</option>
          <option>Correção ou retirada de dado pessoal (LGPD)</option><option>Acessibilidade</option><option>Outro</option>
        </select></div>
      <div class="field"><label for="c-mensagem">Mensagem</label><textarea id="c-mensagem" required aria-describedby="c-aviso"></textarea></div>
      <p class="tiny" id="c-aviso">Não informe CPF, dados de saúde ou de estudantes. Para assuntos reservados, use os canais oficiais do Conselho.</p>
      <div class="actions" style="margin-top:0">
        <button class="btn" type="submit">Preparar e-mail</button>
        <button class="btn ghost" type="button" id="contato-issue" hidden>Abrir pergunta pública no GitHub</button>
      </div>
      <p class="tiny" id="contato-sem-email" hidden>O e-mail público do Conselho ainda não foi informado neste site; o formulário mostrará o texto pronto para você copiar.</p>
    </form>
    <div id="contato-saida"></div>
  </section>
</div>''', ['paginas'])

# ---------------------------------------------------------------- Mural
pagina('mural', 'mural', 'Mural de discussões',
       'Mural público e moderado de discussões do CME Montanha, baseado nas Discussões do GitHub. Assuntos reservados não devem ser tratados ali.',
       'Mural', cabeca_pagina('Participação', 'Mural de discussões',
                              'Espaço público para perguntas e sugestões de interesse geral, hospedado nas Discussões do GitHub.') + '''
<div class="wrap prose">
  <div class="notice warn" role="note"><strong>O mural é público e moderado.</strong>
    <p>Tudo o que for escrito no mural pode ser lido por qualquer pessoa na internet. Não publique dados pessoais (CPF, telefone, endereço, informações de saúde ou de estudantes) nem assuntos reservados — esses temas devem seguir pelos canais oficiais do Conselho. Mensagens ofensivas, com dados pessoais ou fora do tema podem ser ocultadas ou removidas pela moderação.</p></div>
  <h2>Como participar</h2>
  <ol>
    <li>Crie uma conta gratuita no GitHub (ou entre com a sua).</li>
    <li>Abra as Discussões do repositório do site pelo botão abaixo.</li>
    <li>Procure se o assunto já foi tratado; se não, inicie uma nova discussão com título claro.</li>
  </ol>
  <p id="mural-link" hidden><a class="btn" href="../contato/index.html">Abrir as Discussões no GitHub</a></p>
  <h2>Mural incorporado</h2>
  <div id="mural-giscus"><div class="empty-state"><p>O mural incorporado está desativado. Quando ativado pelo Conselho, as discussões aparecerão aqui; até lá, use o link acima ou a página <a href="../contato/index.html">Fale com o CME</a>.</p></div></div>
  <p class="tiny">Nenhum conteúdo de terceiros é carregado nesta página enquanto o mural incorporado estiver desativado.</p>
</div>''', ['paginas'])

# ---------------------------------------------------------------- FAQ
pagina('faq', 'faq', 'Perguntas frequentes',
       'Perguntas frequentes sobre o Conselho Municipal de Educação de Montanha (ES) e sobre o uso deste site.',
       'Perguntas frequentes', cabeca_pagina('Participação', 'Perguntas frequentes',
                                             'Respostas rápidas, com a fonte de cada informação.') + '''
<div class="wrap prose">
  <form class="filters" role="search" onsubmit="return false" hidden style="grid-template-columns:1fr">
    <div class="field"><label for="faq-filtro">Filtrar perguntas</label><input type="search" id="faq-filtro" autocomplete="off"></div>
  </form>
  <p class="result-count" id="faq-contagem" role="status" aria-live="polite"></p>
  <div id="faq-lista" class="faq-list"><p class="tiny">Carregando…</p></div>
</div>''', ['paginas'])

# ---------------------------------------------------------------- Glossário
pagina('glossario', 'glossario', 'Glossário',
       'Glossário de termos usados pelo Conselho Municipal de Educação de Montanha (ES) e na gestão educacional.',
       'Glossário', cabeca_pagina('Participação', 'Glossário', 'Termos usados nos documentos do Conselho, em ordem alfabética.') + '''
<div class="wrap prose">
  <form class="filters" role="search" onsubmit="return false" hidden style="grid-template-columns:1fr">
    <div class="field"><label for="glossario-filtro">Filtrar termos</label><input type="search" id="glossario-filtro" autocomplete="off"></div>
  </form>
  <nav aria-label="Letras do glossário"><ul class="letter-nav" id="glossario-letras"></ul></nav>
  <div id="glossario-lista"><p class="tiny">Carregando…</p></div>
</div>''', ['paginas'])

# ---------------------------------------------------------------- Links
pagina('links', 'links', 'Links úteis',
       'Links úteis para consulta: órgãos e sistemas relacionados à educação e aos conselhos de educação.',
       'Links úteis', cabeca_pagina('Participação', 'Links úteis', 'Endereços externos de consulta. Os links abrem sites de outros órgãos em nova aba.') +
       f'<div class="wrap"><section aria-labelledby="oficiais-t"><h2 id="oficiais-t">Fontes oficiais do município</h2>{fontes_oficiais()}</section>'
       '<section class="section" aria-labelledby="outros-links-t"><h2 id="outros-links-t">Outros links</h2>'
       '<div id="links-lista"><p class="tiny">Carregando…</p></div></section></div>', ['paginas'])

# ---------------------------------------------------------------- Privacidade
pagina('privacidade', 'privacidade', 'Privacidade e proteção de dados',
       'Como este site trata dados pessoais (LGPD): não coleta dados, não usa cookies nem rastreadores; como pedir correção ou retirada de dado pessoal.',
       'Privacidade', cabeca_pagina('Este site', 'Privacidade e proteção de dados',
                                    'Este site foi feito para não coletar dados pessoais de quem o visita.') + '''
<div class="wrap prose">
  <section class="panel"><h2>O que este site coleta</h2>
    <p><strong>Nada.</strong> O site não usa cookies, não tem ferramentas de análise de audiência, não carrega rastreadores nem anúncios e não envia formulários para servidores.</p>
    <ul>
      <li>A escolha de tema claro ou escuro fica salva apenas no seu navegador (armazenamento local) e pode ser apagada a qualquer momento.</li>
      <li>O formulário “Fale com o CME” apenas monta uma mensagem no seu próprio programa de e-mail; nada é gravado pelo site.</li>
      <li>O site é hospedado no GitHub Pages. Como qualquer servidor, o serviço de hospedagem pode registrar dados técnicos de acesso (como o endereço IP), conforme a política de privacidade do GitHub.</li>
      <li>O mural incorporado (quando ativado pelo Conselho) e as Discussões do GitHub são serviços do GitHub, sujeitos às regras daquela plataforma.</li>
    </ul>
  </section>
  <section class="panel"><h2>Documentos publicados</h2>
    <p>Os documentos deste site são atos e registros públicos do Conselho, divulgados em respeito ao princípio da publicidade (Constituição Federal, art. 37) e à Lei de Acesso à Informação (Lei nº 12.527/2011). Antes da publicação, os documentos passam por triagem para não expor dados pessoais desnecessários, nos termos da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).</p>
  </section>
  <section class="panel" id="pedido"><h2>Como pedir correção ou retirada de dado pessoal</h2>
    <ol>
      <li>Acesse <a href="../contato/index.html">Fale com o CME</a> e escolha o assunto “Correção ou retirada de dado pessoal (LGPD)”.</li>
      <li>Informe o documento (título e número) e o trecho em que o dado aparece. Não envie documentos pessoais pelo formulário.</li>
      <li>O Conselho analisará o pedido; quando cabível, publicará versão com o dado protegido, preservando o ato original em seus arquivos.</li>
    </ol>
  </section>
</div>''')

# ---------------------------------------------------------------- Acessibilidade
pagina('acessibilidade', 'acessibilidade', 'Acessibilidade',
       'Declaração de acessibilidade do site do CME Montanha, recursos disponíveis, atalhos de teclado e como relatar barreiras.',
       'Acessibilidade', cabeca_pagina('Este site', 'Acessibilidade',
                                       'Este site foi construído buscando atender às Diretrizes de Acessibilidade para Conteúdo Web (WCAG 2.1), nível AA.') + '''
<div class="wrap prose">
  <section class="panel"><h2>Recursos disponíveis</h2>
    <ul>
      <li>Navegação completa por teclado, com foco sempre visível.</li>
      <li>Link “Pular para o conteúdo” no início de cada página.</li>
      <li>Contraste de cores adequado e tema escuro (automático conforme o sistema ou pelo botão no topo).</li>
      <li>Textos em tamanho legível, que podem ser ampliados pelo navegador sem perda de conteúdo.</li>
      <li>Leiaute adaptável a celulares, tablets e computadores, e versão para impressão.</li>
      <li>Animações reduzidas quando o sistema pede menos movimento.</li>
      <li>Situações dos documentos indicadas por texto, não apenas por cor.</li>
    </ul>
  </section>
  <section class="panel"><h2>Atalhos de teclado</h2>
    <div class="table-wrap"><table><thead><tr><th scope="col">Tecla</th><th scope="col">Ação</th></tr></thead><tbody>
      <tr><td><kbd>/</kbd></td><td>Abrir a busca do site</td></tr>
      <tr><td><kbd>Esc</kbd></td><td>Fechar a busca ou o menu</td></tr>
      <tr><td><kbd>Tab</kbd> / <kbd>Shift</kbd> + <kbd>Tab</kbd></td><td>Avançar / voltar entre links e campos</td></tr>
      <tr><td><kbd>←</kbd> <kbd>→</kbd> <kbd>Home</kbd> <kbd>End</kbd></td><td>Trocar de aba na página de reuniões</td></tr>
      <tr><td><kbd>Enter</kbd> / <kbd>Espaço</kbd></td><td>Abrir detalhes (perguntas, verificação de integridade)</td></tr>
    </tbody></table></div>
  </section>
  <section class="panel"><h2>Limitações conhecidas</h2>
    <p>Alguns documentos em PDF podem ser digitalizações de papel, sem texto selecionável, o que dificulta a leitura por leitores de tela. Se precisar de uma versão acessível de algum documento, peça pela página <a href="../contato/index.html">Fale com o CME</a> (assunto “Acessibilidade”).</p>
  </section>
</div>''')

# ---------------------------------------------------------------- Busca
pagina('busca', 'busca', 'Busca',
       'Busca em todos os documentos e conteúdos publicados pelo Conselho Municipal de Educação de Montanha (ES).',
       'Busca', cabeca_pagina('Este site', 'Buscar no site', 'Busque em títulos, números, assuntos, perguntas frequentes e glossário. A busca ignora acentos.') + '''
<div class="wrap">
  <form class="filters" role="search" action="index.html" method="get" style="grid-template-columns:1fr">
    <div class="field"><label for="busca-pagina">Termo de busca</label><input type="search" id="busca-pagina" name="q" autocomplete="off" placeholder="Ex.: resolução 2025, ata, regimento"></div>
  </form>
  <p class="result-count" id="busca-status" role="status" aria-live="polite"><noscript>A busca precisa de JavaScript ativado.</noscript></p>
  <ul class="search-results" id="busca-resultados"></ul>
</div>''')


PAGINA_404 = '''
<div class="wrap page-head">
  <p class="eyebrow">Erro 404</p>
  <h1>Página não encontrada</h1>
  <p class="lead">O endereço pode ter mudado ou o documento pode ter sido reorganizado.</p>
  <div class="actions">
    <a class="btn" href="index.html">Ir para o início</a>
    <a class="btn ghost" href="busca/index.html">Buscar no site</a>
    <a class="btn ghost" href="reunioes/index.html">Reuniões</a>
  </div>
</div>'''


def main():
    criadas = []
    for slug, pid, titulo, descricao, migalha, corpo, scripts in PAGINAS:
        destino = RAIZ / slug / 'index.html' if slug else RAIZ / 'index.html'
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(documento(slug, pid, titulo, descricao, migalha, corpo, scripts), encoding='utf-8', newline='\n')
        criadas.append(destino.relative_to(RAIZ).as_posix())
    p404 = documento('', '404', 'Página não encontrada', 'A página procurada não foi encontrada no site do CME Montanha.',
                     None, PAGINA_404, [], profundidade='', extra_head=SCRIPT_BASE_404 + '\n<meta name="robots" content="noindex">\n')
    (RAIZ / '404.html').write_text(p404, encoding='utf-8', newline='\n')
    criadas.append('404.html')
    print('Páginas geradas:', len(criadas))
    for c in criadas:
        print(' -', c)


if __name__ == '__main__':
    main()
