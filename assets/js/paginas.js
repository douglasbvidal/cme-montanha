/* CME Montanha — renderizadores por página (lidos de data/*.json e site.config.json).
   Tolerante a chaves ausentes: seção sem dados é omitida ou mostra estado vazio. */
(function () {
  'use strict';
  var CME = window.CME;
  if (!CME) return;
  var esc = CME.esc;

  function $(id) { return document.getElementById(id); }
  function conteudo() { return CME.carregar('data/conteudo.json').then(CME.objeto); }
  function paragrafos(t) {
    return String(t).split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }
  function blocoTexto(v) {
    return CME.itensTexto(v).map(function (x) {
      return paragrafos(x.texto) + CME.fonteHTML(x.fonte, x.artigo);
    }).join('');
  }
  function humanizar(k) {
    var s = String(k).replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ---------------- Início ---------------- */
  function inicio() {
    CME.proximasReunioes && CME.proximasReunioes($('home-reunioes'), 3);
    var el = $('home-documentos');
    if (!el) return;
    CME.carregar('data/documentos.json').then(function (res) {
      var docs = CME.lista(res).filter(function (d) { return d && d.id != null && CME.dataValida(d.data); })
        .sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; }).slice(0, 5);
      if (!docs.length) { CME.vazio(el, 'Nenhum documento publicado ainda.'); return; }
      el.innerHTML = '<ul class="doc-list">' + docs.map(function (d) {
        var cat = CME.CATEGORIAS[d.categoria] || CME.CATEGORIAS.outros;
        var st = CME.STATUS_DOC[d.status];
        var externo = CME.ehExterno(d);
        var href = externo ? null : CME.hrefArquivo(d.arquivo);
        return '<li><article class="doc-card"><div class="doc-top">' +
          (st ? '<span class="badge ' + esc(d.status) + '">' + esc(st) + '</span>' : '') +
          '<span class="badge tipo">' + esc(cat.rotulo) + '</span><span class="tiny">' + esc(CME.formatarData(d.data)) + '</span></div>' +
          '<h3><a href="' + esc(CME.linkPagina(d)) + '">' + esc(d.titulo || 'Documento sem título') + '</a></h3>' +
          (d.assunto ? '<p class="assunto">' + esc(d.assunto) + '</p>' : '') +
          (externo ? '<div class="doc-actions"><a class="text-link" href="' + esc(d.url) + '" target="_blank" rel="noopener">Abrir no site oficial <span aria-hidden="true">↗</span><span class="sr-only">(abre em nova aba)</span></a> <span class="badge externo">' + esc(CME.ROTULO_EXTERNO) + '</span></div>' : '') +
          (href ? '<div class="doc-actions"><a class="text-link" href="' + esc(href) + '" download>Baixar PDF' +
            ([CME.tamanho(d.tamanho_kb), CME.paginas(d.paginas)].filter(Boolean).length ? ' (' + esc([CME.tamanho(d.tamanho_kb), CME.paginas(d.paginas)].filter(Boolean).join(', ')) + ')' : '') +
            '</a></div>' : '') +
          '</article></li>';
      }).join('') + '</ul>';
    });
  }

  /* ---------------- Sobre ---------------- */
  function sobre() {
    var el = $('sobre-conteudo');
    conteudo().then(function (c) {
      var s = c.sobre && typeof c.sobre === 'object' ? c.sobre : null;
      if (!s) { CME.vazio(el, 'As informações institucionais serão publicadas após conferência das fontes oficiais.'); return; }
      var html = '';
      var ordem = Object.keys(CME.ROTULOS_SOBRE).filter(function (k) { return k in s; })
        .concat(Object.keys(s).filter(function (k) { return !(k in CME.ROTULOS_SOBRE); }));
      ordem.forEach(function (k) {
        var itens = CME.itensTexto(s[k]);
        if (!itens.length) return;
        var id = CME.slug(k), rot = CME.ROTULOS_SOBRE[k] || humanizar(k);
        var corpo = (k === 'competencias' && itens.length > 1)
          ? '<ul>' + itens.map(function (x) { return '<li>' + esc(x.texto) + CME.fonteHTML(x.fonte, x.artigo) + '</li>'; }).join('') + '</ul>'
          : blocoTexto(itens);
        if (k === 'regimento') corpo += '<p><a class="text-link" href="../regimento/index.html">Ver a página do regimento interno</a></p>';
        html += '<section class="panel" id="' + id + '" aria-labelledby="' + id + '-t"><h2 id="' + id + '-t">' + esc(rot) + '</h2>' + corpo + '</section>';
      });
      if (html) el.innerHTML = html;
      else CME.vazio(el, 'As informações institucionais serão publicadas após conferência das fontes oficiais.');
      setTimeout(CME.focarAlvo, 0);
    });
  }

  /* ---------------- Regimento: aviso factual ---------------- */
  function regimento() {
    var el = $('regimento-aviso');
    if (!el) return;
    Promise.all([conteudo(), CME.carregar('data/documentos.json')]).then(function (r) {
      var c = r[0], partes = [];
      function juntar(reg) {
        if (!reg) return;
        if (reg && typeof reg === 'object' && !Array.isArray(reg) && reg.texto == null) {
          ['situacao', 'status_homologacao', 'homologacao', 'aviso'].forEach(function (k) { partes = partes.concat(CME.itensTexto(reg[k])); });
        } else partes = partes.concat(CME.itensTexto(reg));
      }
      juntar(c.regimento);
      if (c.sobre && typeof c.sobre === 'object') juntar(c.sobre.regimento);
      CME.lista(r[1]).forEach(function (d) {
        if (d && d.categoria === 'regimento' && d.observacao) partes.push({ texto: (d.titulo ? d.titulo + ': ' : '') + d.observacao });
      });
      if (!partes.length) {
        el.innerHTML = '<div class="notice"><strong>Situação do Regimento Interno</strong><p>A informação sobre a homologação do Regimento Interno ainda não foi publicada nesta página. Consulte os documentos abaixo e, em caso de dúvida, o ato oficial correspondente.</p></div>';
        return;
      }
      el.innerHTML = '<div class="notice warn" role="note"><strong>Situação do Regimento Interno</strong>' +
        partes.map(function (p) { return '<p>' + esc(p.texto) + '</p>' + CME.fonteHTML(p.fonte, p.artigo); }).join('') + '</div>';
    });
  }

  /* ---------------- Conselheiros ---------------- */
  function conselheiros() {
    var el = $('lista-conselheiros');
    CME.carregar('data/conselheiros.json').then(function (res) {
      var lista = CME.lista(res).filter(function (p) { return p && p.nome; });
      if (!lista.length) { CME.vazio(el, 'Composição será publicada após conferência do ato oficial.'); return; }
      var html = '';
      var mesa = lista.filter(function (p) { return p.cargo_mesa; });
      if (mesa.length) {
        html += '<section class="panel" aria-labelledby="mesa-t"><h2 id="mesa-t">Mesa diretora</h2><ul>' +
          mesa.map(function (p) { return '<li><strong>' + esc(p.cargo_mesa) + ':</strong> ' + esc(p.nome) + '</li>'; }).join('') + '</ul></section>';
      }
      var grupos = {}, ordem = [];
      lista.forEach(function (p) {
        var g = p.segmento || 'Segmento não informado';
        if (!grupos[g]) { grupos[g] = []; ordem.push(g); }
        grupos[g].push(p);
      });
      html += '<div class="table-wrap" style="margin-top:16px"><table><caption>Composição por segmento</caption><thead><tr>' +
        '<th scope="col">Nome</th><th scope="col">Condição</th><th scope="col">Entidade</th><th scope="col">Mandato</th></tr></thead><tbody>';
      ordem.forEach(function (g) {
        html += '<tr><th scope="rowgroup" colspan="4">' + esc(g) + '</th></tr>';
        grupos[g].sort(function (a, b) { return (a.condicao === 'titular' ? 0 : 1) - (b.condicao === 'titular' ? 0 : 1); })
          .forEach(function (p) {
            var cond = p.condicao ? p.condicao.charAt(0).toUpperCase() + p.condicao.slice(1) : '—';
            html += '<tr><td>' + esc(p.nome) + (p.cargo_mesa ? ' <span class="badge tipo">' + esc(p.cargo_mesa) + '</span>' : '') + '</td><td>' + esc(cond) +
              '</td><td>' + esc(p.entidade || '—') + '</td><td>' + esc(p.mandato || '—') + '</td></tr>';
          });
      });
      html += '</tbody></table></div>';
      var fontes = [];
      lista.forEach(function (p) { var f = CME.fontePublica(p.fonte); if (f && fontes.indexOf(f) === -1) fontes.push(f); });
      if (fontes.length) html += '<p class="fonte">' + esc(fontes.join('; ')) + '</p>';
      el.innerHTML = html;
    });
  }

  /* ---------------- Transparência ---------------- */
  function valorHTML(v, nivel) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return paragrafos(String(v));
    if (Array.isArray(v)) {
      return '<ul>' + v.map(function (x) {
        if (x && typeof x === 'object') {
          var tit = x.titulo || x.nome || x.termo || '';
          var url = CME.urlExterna(x.url);
          var txt = CME.texto(x.texto != null ? x.texto : (x.descricao != null ? x.descricao : x.valor));
          return '<li>' + (tit ? (url ? '<a href="' + esc(url) + '" rel="noopener">' + esc(tit) + '</a>' : '<strong>' + esc(tit) + '</strong>') + (txt ? ': ' : '') : '') +
            esc(txt) + CME.fonteHTML(x.fonte, x.artigo) + '</li>';
        }
        return '<li>' + esc(x) + '</li>';
      }).join('') + '</ul>';
    }
    if (typeof v === 'object') {
      if (v.texto != null) return blocoTexto(v);
      var h = 'h' + Math.min(nivel + 1, 4), out = '';
      Object.keys(v).forEach(function (k) {
        if (k === 'fonte') return;
        out += '<' + h + '>' + esc(humanizar(k)) + '</' + h + '>' + valorHTML(v[k], nivel + 1);
      });
      return out + CME.fonteHTML(v.fonte);
    }
    return '';
  }
  function transparencia() {
    var el = $('transparencia-conteudo');
    var est = $('transparencia-numeros');
    conteudo().then(function (c) {
      var t = c.transparencia;
      if (t && typeof t === 'object' && Object.keys(t).length) {
        var html = '';
        if (Array.isArray(t)) html = '<section class="panel">' + valorHTML(t, 2) + '</section>';
        else Object.keys(t).forEach(function (k) {
          if (k === 'fonte') return;
          html += '<section class="panel"><h2>' + esc(humanizar(k)) + '</h2>' + valorHTML(t[k], 2) + '</section>';
        });
        el.innerHTML = html;
      } else if (typeof t === 'string' && t.trim()) {
        el.innerHTML = '<section class="panel">' + paragrafos(t) + '</section>';
      } else {
        CME.vazio(el, 'As informações de transparência serão publicadas após conferência das fontes oficiais.');
      }
    });
    if (est) CME.carregar('data/documentos.json').then(function (res) {
      var docs = CME.lista(res);
      if (!docs.length) { CME.vazio(est, 'Nenhum documento publicado ainda.'); return; }
      var cont = {};
      docs.forEach(function (d) { var k = CME.CATEGORIAS[d.categoria] ? d.categoria : 'outros'; cont[k] = (cont[k] || 0) + 1; });
      est.innerHTML = '<div class="table-wrap"><table><caption>Documentos publicados por tipo</caption><thead><tr><th scope="col">Tipo</th><th scope="col">Quantidade</th></tr></thead><tbody>' +
        Object.keys(CME.CATEGORIAS).filter(function (k) { return cont[k]; }).map(function (k) {
          return '<tr><td><a href="' + esc(CME.raiz + CME.CATEGORIAS[k].pagina + (CME.CATEGORIAS[k].aba ? '?aba=' + CME.CATEGORIAS[k].aba : '')) + '">' + esc(CME.CATEGORIAS[k].rotulo) + '</a></td><td>' + cont[k] + '</td></tr>';
        }).join('') + '<tr><th scope="row">Total</th><td><strong>' + docs.length + '</strong></td></tr></tbody></table></div>';
    });
  }

  /* ---------------- Repositório (config) ---------------- */
  CME.repositorio = function (cfg) {
    var r = typeof cfg.repositorio === 'string' ? cfg.repositorio.trim() : '';
    r = r.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
    return /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(r) ? 'https://github.com/' + r : '';
  };

  /* ---------------- Contato ---------------- */
  function contato() {
    CME.config().then(function (cfg) {
      var email = typeof cfg.email_publico === 'string' && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(cfg.email_publico.trim()) ? cfg.email_publico.trim() : '';
      var dados = $('contato-dados');
      var linhas = [
        ['E-mail', email ? '<a href="mailto:' + esc(email) + '">' + esc(email) + '</a>' : ''],
        ['Endereço', cfg.endereco ? esc(cfg.endereco) : ''],
        ['Telefone', cfg.telefone_publico ? esc(cfg.telefone_publico) : '']
      ];
      dados.innerHTML = '<dl class="doc-meta" style="display:grid;gap:8px">' + linhas.map(function (l) {
        return '<div><dt>' + l[0] + ':</dt><dd>' + (l[1] || '<span class="muted">ainda não informado neste site</span>') + '</dd></div>';
      }).join('') + '</dl>';

      var repo = CME.repositorio(cfg);
      var form = $('form-contato');
      var saida = $('contato-saida');
      var btnIssue = $('contato-issue');
      if (!email) {
        $('contato-sem-email').hidden = false;
      }
      if (repo && btnIssue) btnIssue.hidden = false;
      function montar() {
        var nome = $('c-nome').value.trim();
        var assunto = $('c-assunto').value;
        var msg = $('c-mensagem').value.trim();
        var corpo = msg + (nome ? '\n\n— ' + nome : '') + '\n\n(Mensagem preparada pelo formulário do site do CME Montanha.)';
        return { titulo: '[Site CME] ' + assunto, corpo: corpo, msg: msg };
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var m = montar();
        if (!m.msg) { saida.innerHTML = '<div class="notice warn" role="alert"><p>Escreva a mensagem antes de continuar.</p></div>'; $('c-mensagem').focus(); return; }
        if (!email) {
          saida.innerHTML = '<div class="notice warn" role="status"><p>O e-mail público do CME ainda não foi informado neste site. Copie o texto abaixo e use os canais oficiais.</p></div>' +
            '<pre class="hash" style="white-space:pre-wrap">' + esc(m.titulo + '\n\n' + m.corpo) + '</pre>';
          return;
        }
        var href = 'mailto:' + email + '?subject=' + encodeURIComponent(m.titulo) + '&body=' + encodeURIComponent(m.corpo);
        saida.innerHTML = '<div class="notice" role="status"><p>Seu programa de e-mail deve abrir com a mensagem pronta. Se não abrir, <a href="' + esc(href) + '">clique aqui</a> ou copie o texto abaixo e envie para <strong>' + esc(email) + '</strong>.</p></div>' +
          '<pre class="hash" style="white-space:pre-wrap">' + esc(m.titulo + '\n\n' + m.corpo) + '</pre>';
        window.location.href = href;
      });
      if (btnIssue) btnIssue.addEventListener('click', function () {
        var m = montar();
        if (!m.msg) { $('c-mensagem').focus(); return; }
        if (!window.confirm('A pergunta será PÚBLICA no GitHub (exige conta). Não inclua dados pessoais ou assuntos reservados. Continuar?')) return;
        window.open(repo + '/issues/new?title=' + encodeURIComponent(m.titulo) + '&body=' + encodeURIComponent(m.msg), '_blank', 'noopener');
      });
      var disc = $('contato-discussoes');
      if (repo && disc) disc.hidden = false;
    });
  }

  /* ---------------- Mural ---------------- */
  function mural() {
    CME.config().then(function (cfg) {
      var repo = CME.repositorio(cfg);
      var link = $('mural-link');
      if (repo && link) { link.hidden = false; link.querySelector('a').href = repo + '/discussions'; }
      var g = cfg.giscus && typeof cfg.giscus === 'object' ? cfg.giscus : null;
      var alvo = $('mural-giscus');
      var ok = g && g.ativo === true && /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(g.repo || '') && g.repo_id && g.categoria && g.categoria_id;
      if (!ok) return; /* desativado por padrão: nenhum script de terceiros é carregado */
      alvo.innerHTML = '<p class="tiny">Comentários carregados do GitHub (serviço giscus). Ao interagir, você estará sujeito aos termos e à política de privacidade do GitHub.</p>';
      var escuro = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var s = document.createElement('script');
      s.src = 'https://giscus.app/client.js';
      s.async = true;
      s.crossOrigin = 'anonymous';
      var attrs = { 'data-repo': g.repo, 'data-repo-id': g.repo_id, 'data-category': g.categoria, 'data-category-id': g.categoria_id,
        'data-mapping': 'specific', 'data-term': 'Mural do CME', 'data-strict': '1', 'data-reactions-enabled': '0',
        'data-emit-metadata': '0', 'data-input-position': 'top', 'data-theme': escuro ? 'dark' : 'light', 'data-lang': 'pt', 'data-loading': 'lazy' };
      Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
      alvo.appendChild(s);
    });
  }

  /* ---------------- FAQ ---------------- */
  function faq() {
    var el = $('faq-lista');
    conteudo().then(function (c) {
      var itens = Array.isArray(c.faq) ? c.faq.filter(function (f) { return f && f.pergunta; }) : [];
      if (!itens.length) { CME.vazio(el, 'Perguntas frequentes serão publicadas em breve.'); return; }
      var filtro = $('faq-filtro');
      filtro.closest('.filters').hidden = false;
      function desenhar() {
        var termos = CME.termos(filtro.value), n = 0;
        el.innerHTML = itens.map(function (f, i) {
          var chave = CME.normalizar(f.pergunta + ' ' + CME.texto(f.resposta));
          for (var k = 0; k < termos.length; k++) if (chave.indexOf(termos[k]) === -1) return '';
          n++;
          return '<details class="faq-item" id="faq-' + (i + 1) + '"' + (termos.length ? ' open' : '') + '><summary>' + CME.realcar(f.pergunta, termos) + '</summary>' +
            '<div>' + CME.realcar(CME.texto(f.resposta), termos).split(/\n{2,}/).map(function (p) { return '<p>' + p + '</p>'; }).join('') + CME.fonteHTML(f.fonte, f.artigo) + '</div></details>';
        }).join('') || '<div class="empty-state"><p>Nenhuma pergunta corresponde à busca.</p></div>';
        $('faq-contagem').textContent = n + (n === 1 ? ' pergunta' : ' perguntas');
      }
      filtro.addEventListener('input', desenhar);
      desenhar();
      setTimeout(CME.focarAlvo, 0);
    });
  }

  /* ---------------- Glossário ---------------- */
  function glossario() {
    var el = $('glossario-lista');
    conteudo().then(function (c) {
      var itens = Array.isArray(c.glossario) ? c.glossario.filter(function (g) { return g && g.termo; }) : [];
      if (!itens.length) { CME.vazio(el, 'O glossário será publicado em breve.'); return; }
      itens.sort(function (a, b) { return String(a.termo).localeCompare(String(b.termo), 'pt-BR'); });
      var filtro = $('glossario-filtro');
      filtro.closest('.filters').hidden = false;
      function desenhar() {
        var termos = CME.termos(filtro.value), letras = [], html = '', atual = '';
        itens.forEach(function (g) {
          var chave = CME.normalizar(g.termo + ' ' + CME.texto(g.definicao));
          for (var k = 0; k < termos.length; k++) if (chave.indexOf(termos[k]) === -1) return;
          var l = CME.normalizar(g.termo).charAt(0).toUpperCase();
          if (l !== atual) { atual = l; letras.push(l); html += (html ? '</dl>' : '') + '<h2 id="letra-' + esc(l) + '">' + esc(l) + '</h2><dl class="glossary">'; }
          html += '<dt id="termo-' + CME.slug(g.termo) + '">' + CME.realcar(g.termo, termos) + '</dt><dd>' + CME.realcar(CME.texto(g.definicao), termos) + CME.fonteHTML(g.fonte) + '</dd>';
        });
        $('glossario-letras').innerHTML = letras.map(function (l) { return '<li><a href="#letra-' + esc(l) + '">' + esc(l) + '</a></li>'; }).join('');
        el.innerHTML = html ? html + '</dl>' : '<div class="empty-state"><p>Nenhum termo corresponde à busca.</p></div>';
      }
      filtro.addEventListener('input', desenhar);
      desenhar();
      setTimeout(CME.focarAlvo, 0);
    });
  }

  /* ---------------- Links ---------------- */
  function links() {
    var el = $('links-lista');
    conteudo().then(function (c) {
      var itens = CME.linksConteudo(c);
      if (!itens.length) { el.innerHTML = ''; var s = el.closest('section'); if (s) s.hidden = true; return; }
      el.innerHTML = '<div class="grid cols-3">' + itens.map(function (l) {
        var host = '';
        try { host = new URL(l.url).hostname.replace(/^www\./, ''); } catch (e) { host = ''; }
        return '<a class="source-card" href="' + esc(l.url) + '" target="_blank" rel="noopener"><h3><span class="source-icon">' + CME.icone('external') + '</span>' + esc(l.titulo) + '</h3>' +
          (l.descricao ? '<p>' + esc(l.descricao) + '</p>' : '') + (host ? '<p class="tiny">' + esc(host) + ' <span class="sr-only">(site externo)</span></p>' : '') + '</a>';
      }).join('') + '</div>';
    });
  }

  var mapa = { inicio: inicio, sobre: sobre, regimento: regimento, conselheiros: conselheiros, transparencia: transparencia,
    contato: contato, mural: mural, faq: faq, glossario: glossario, links: links };
  CME.pronto(function () { if (mapa[CME.pagina]) mapa[CME.pagina](); });
})();
