/* CME Montanha — busca global client-side (documentos.json + conteudo.json).
   Atalho "/" abre a busca. Sem JavaScript, o formulário leva a busca/index.html. */
(function () {
  'use strict';
  var CME = window.CME;
  if (!CME) return;

  var indicePromessa = null;

  function item(tipo, titulo, meta, texto, url, extra) {
    return { tipo: tipo, titulo: titulo || '', meta: meta || '', texto: texto || '', url: url, extra: extra || null,
      chave: CME.normalizar([titulo, meta, texto].join(' ')), chaveTitulo: CME.normalizar(titulo) };
  }

  CME.indiceBusca = function () {
    if (indicePromessa) return indicePromessa;
    indicePromessa = Promise.all([CME.carregar('data/documentos.json'), CME.carregar('data/conteudo.json')])
      .then(function (r) {
        var idx = [];
        CME.lista(r[0]).forEach(function (d) {
          if (!d || d.id == null) return;
          var cat = CME.CATEGORIAS[d.categoria] || CME.CATEGORIAS.outros;
          var meta = [cat.rotulo, d.numero ? 'nº ' + d.numero : '', d.ano || '', CME.STATUS_DOC[d.status] || '']
            .filter(Boolean).join(' · ');
          var texto = [d.assunto, d.emissor, d.observacao].filter(Boolean).join(' — ');
          idx.push(item('Documento', d.titulo || 'Documento sem título', meta, texto, CME.linkPagina(d),
            { pdf: CME.ehExterno(d) ? null : CME.hrefArquivo(d.arquivo), externo: CME.ehExterno(d) }));
        });
        var c = CME.objeto(r[1]);
        var sobre = c.sobre && typeof c.sobre === 'object' ? c.sobre : null;
        if (sobre) {
          Object.keys(sobre).forEach(function (k) {
            var rot = CME.ROTULOS_SOBRE[k] || (k.charAt(0).toUpperCase() + k.replace(/_/g, ' ').slice(1));
            var dest = (k === 'regimento' ? CME.raiz + 'regimento/index.html' : CME.raiz + 'sobre/index.html#' + CME.slug(k));
            CME.itensTexto(sobre[k]).forEach(function (x) {
              idx.push(item('Sobre o CME', rot, '', x.texto, dest));
            });
          });
        }
        if (c.transparencia && typeof c.transparencia === 'object') {
          Object.keys(c.transparencia).forEach(function (k) {
            CME.itensTexto(c.transparencia[k]).forEach(function (x) {
              idx.push(item('Transparência', k.charAt(0).toUpperCase() + k.replace(/_/g, ' ').slice(1), '', x.texto, CME.raiz + 'transparencia/index.html'));
            });
          });
        }
        if (Array.isArray(c.faq)) c.faq.forEach(function (f, i) {
          if (f && f.pergunta) idx.push(item('Pergunta frequente', f.pergunta, '', CME.texto(f.resposta), CME.raiz + 'faq/index.html#faq-' + (i + 1)));
        });
        if (Array.isArray(c.glossario)) c.glossario.forEach(function (g) {
          if (g && g.termo) idx.push(item('Glossário', g.termo, '', CME.texto(g.definicao), CME.raiz + 'glossario/index.html#termo-' + CME.slug(g.termo)));
        });
        CME.linksConteudo(c).forEach(function (l) {
          if (l && l.titulo && CME.urlExterna(l.url)) idx.push(item('Link útil', l.titulo, '', CME.texto(l.descricao), CME.raiz + 'links/index.html'));
        });
        return { itens: idx, falhou: !r[0].ok && !r[1].ok, motivo: r[0].motivo || r[1].motivo };
      });
    return indicePromessa;
  };

  CME.buscar = function (indice, consulta) {
    var termos = CME.termos(consulta);
    if (!termos.length) return { termos: termos, resultados: [] };
    var res = [];
    indice.itens.forEach(function (it) {
      for (var i = 0; i < termos.length; i++) if (it.chave.indexOf(termos[i]) === -1) return;
      var score = 0;
      termos.forEach(function (t) { if (it.chaveTitulo.indexOf(t) !== -1) score += 3; score += 1; });
      if (it.tipo === 'Documento') score += 0.5;
      res.push({ it: it, score: score });
    });
    res.sort(function (a, b) { return b.score - a.score || a.it.titulo.localeCompare(b.it.titulo, 'pt-BR'); });
    return { termos: termos, resultados: res.map(function (r) { return r.it; }) };
  };

  function trecho(texto, termos) {
    var t = String(texto || '');
    if (t.length <= 220) return t;
    var n = CME.normalizar(t), pos = -1;
    for (var i = 0; i < termos.length && pos === -1; i++) pos = n.indexOf(termos[i]);
    var ini = Math.max(0, pos - 70);
    return (ini > 0 ? '… ' : '') + t.slice(ini, ini + 220) + (ini + 220 < t.length ? ' …' : '');
  }

  CME.renderResultados = function (ul, statusEl, indice, consulta, limite) {
    var r = CME.buscar(indice, consulta);
    var lista = limite ? r.resultados.slice(0, limite) : r.resultados;
    if (!r.termos.length) {
      ul.innerHTML = '';
      statusEl.textContent = indice.itens.length ? 'Digite um termo para buscar em documentos e conteúdos.' : '';
      return;
    }
    statusEl.textContent = r.resultados.length === 0 ? 'Nenhum resultado para “' + consulta + '”.'
      : r.resultados.length + (r.resultados.length === 1 ? ' resultado' : ' resultados') +
        (limite && r.resultados.length > limite ? ' (mostrando ' + limite + ')' : '') + '.';
    ul.innerHTML = lista.map(function (it) {
      var pdf = it.extra && it.extra.pdf ? ' <span class="r-meta">PDF disponível</span>'
        : it.extra && it.extra.externo ? ' <span class="r-meta">' + CME.esc(CME.ROTULO_EXTERNO) + '</span>' : '';
      return '<li><a href="' + CME.esc(it.url) + '"><span class="r-meta">' + CME.esc(it.tipo) +
        (it.meta ? ' · ' + CME.realcar(it.meta, r.termos) : '') + '</span>' +
        '<span class="r-title">' + CME.realcar(it.titulo, r.termos) + '</span>' +
        (it.texto ? '<span class="r-snip">' + CME.realcar(trecho(it.texto, r.termos), r.termos) + '</span>' : '') +
        pdf + '</a></li>';
    }).join('');
  };

  function avisoIndice(indice, statusEl) {
    if (indice.itens.length) return false;
    statusEl.textContent = indice.motivo === 'arquivo-local'
      ? 'A busca precisa ler os dados do site: abra via servidor local ou pelo site publicado.'
      : 'Ainda não há documentos ou conteúdos publicados para buscar.';
    return true;
  }

  /* ---------- Diálogo de busca (todas as páginas) ---------- */
  function iniciarDialogo() {
    var dlg = document.getElementById('search-dialog');
    var abrir = document.querySelectorAll('[data-open-search]');
    if (!dlg || typeof dlg.showModal !== 'function') return; /* sem <dialog>: o link leva à página de busca */
    var input = dlg.querySelector('input[type="search"]');
    var ul = dlg.querySelector('.search-results');
    var st = dlg.querySelector('[data-search-status]');
    var fechar = dlg.querySelector('[data-close-search]');
    var timer;
    function executar() {
      CME.indiceBusca().then(function (idx) {
        if (avisoIndice(idx, st)) { ul.innerHTML = ''; return; }
        CME.renderResultados(ul, st, idx, input.value, 12);
      });
    }
    function mostrar(e) {
      if (e) e.preventDefault();
      if (!dlg.open) dlg.showModal();
      input.focus();
      input.select();
      executar();
    }
    Array.prototype.forEach.call(abrir, function (b) { b.addEventListener('click', mostrar); });
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(executar, 120); });
    if (fechar) fechar.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      var a = document.activeElement;
      var tag = a && a.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (a && a.isContentEditable)) return;
      if (CME.pagina === 'busca') {
        var campo = document.getElementById('busca-pagina');
        if (campo) { e.preventDefault(); campo.focus(); return; }
      }
      mostrar(e);
    });
  }

  /* ---------- Página busca/ ---------- */
  function iniciarPagina() {
    if (CME.pagina !== 'busca') return;
    var input = document.getElementById('busca-pagina');
    var ul = document.getElementById('busca-resultados');
    var st = document.getElementById('busca-status');
    if (!input || !ul || !st) return;
    input.value = CME.parametro('q');
    var timer;
    function executar() {
      CME.indiceBusca().then(function (idx) {
        if (avisoIndice(idx, st)) { ul.innerHTML = ''; return; }
        CME.renderResultados(ul, st, idx, input.value, 0);
      });
    }
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        executar();
        try { history.replaceState(null, '', '?q=' + encodeURIComponent(input.value)); } catch (e) { /* file:// */ }
      }, 150);
    });
    var form = input.form;
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); executar(); });
    executar();
  }

  CME.pronto(function () { iniciarDialogo(); iniciarPagina(); });
})();
