/* CME Montanha — listagem de documentos com filtros, busca, ordenação e verificação SHA-256. */
(function () {
  'use strict';
  var CME = window.CME;
  if (!CME) return;

  function numeroOrdenavel(n) {
    var m = String(n || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : Infinity;
  }
  function anoDoc(d) {
    if (d.ano != null && String(d.ano).match(/^\d{4}$/)) return String(d.ano);
    return CME.dataValida(d.data) ? d.data.slice(0, 4) : '';
  }

  CME.cartaoDocumento = function (d, termos, nivelTitulo) {
    var h = 'h' + (nivelTitulo || 3);
    var cat = CME.CATEGORIAS[d.categoria] || CME.CATEGORIAS.outros;
    var externo = CME.ehExterno(d);
    var href = externo ? null : CME.hrefArquivo(d.arquivo);
    var detalhes = [CME.tamanho(d.tamanho_kb), CME.paginas(d.paginas)].filter(Boolean).join(', ');
    var status = CME.STATUS_DOC[d.status];
    var id = 'doc-' + String(d.id);
    var meta = [];
    if (d.numero) meta.push(['Número', d.numero]);
    meta.push(['Data', CME.formatarData(d.data)]);
    if (d.emissor) meta.push(['Emissor', d.emissor]);
    var sha = typeof d.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(d.sha256) ? d.sha256.toLowerCase() : '';
    var fonte = CME.fontePublica(d.fonte_original);
    var t = termos || [];
    var html = '<li><article class="doc-card" id="' + CME.esc(id) + '" aria-labelledby="' + CME.esc(id) + '-t">' +
      '<div class="doc-top">' +
      (status ? '<span class="badge ' + CME.esc(d.status) + '"><span class="sr-only">Situação: </span>' + CME.esc(status) + '</span>' : '') +
      '<span class="badge tipo">' + CME.esc(cat.rotulo) + '</span>' +
      (externo ? '<span class="badge externo">' + CME.esc(CME.ROTULO_EXTERNO) + '</span>' : '') + '</div>' +
      '<' + h + ' id="' + CME.esc(id) + '-t">' + CME.realcar(d.titulo || 'Documento sem título', t) + '</' + h + '>' +
      (d.assunto ? '<p class="assunto">' + CME.realcar(d.assunto, t) + '</p>' : '') +
      '<dl class="doc-meta">' + meta.map(function (m) {
        return '<div><dt>' + CME.esc(m[0]) + ':</dt><dd>' + CME.realcar(m[1], t) + '</dd></div>';
      }).join('') + '</dl>' +
      (d.observacao ? '<p class="doc-obs"><strong>Observação:</strong> ' + CME.realcar(d.observacao, t) + '</p>' : '') +
      '<div class="doc-actions">' +
      (externo ? '<a class="btn small" href="' + CME.esc(d.url) + '" target="_blank" rel="noopener">' + CME.icone('external') +
        '<span>Abrir no site oficial <span aria-hidden="true">↗</span><span class="sr-only">(abre em nova aba)</span></span></a>'
      : href ? '<a class="btn small" href="' + CME.esc(href) + '" download>' + CME.icone('download') +
        '<span>Baixar PDF' + (detalhes ? ' <span class="tiny" style="color:inherit">(' + CME.esc(detalhes) + ')</span>' : '') + '</span></a>' +
        '<a class="btn small ghost" href="' + CME.esc(href) + '">' + CME.icone('doc') + '<span>Abrir no navegador</span></a>'
        : '<span class="tiny">Arquivo indisponível no momento.</span>') +
      '</div>';
    if (externo) sha = '';
    if (sha || fonte) {
      html += '<details class="integridade"><summary>' + CME.icone(sha ? 'shield' : 'info') +
        (sha ? 'Verificar integridade (SHA-256)' : 'Fonte do registro') + '</summary>';
      if (sha) {
        html += '<p class="tiny">O código abaixo identifica exatamente este arquivo. Se o arquivo baixado gerar o mesmo código, ele não foi alterado.</p>' +
          '<code class="hash">' + sha + '</code>' +
          '<div class="doc-actions"><button type="button" class="btn small ghost" data-copiar="' + sha + '">' + CME.icone('copy') + 'Copiar código</button>' +
          (href ? '<button type="button" class="btn small ghost" data-verificar="' + CME.esc(href) + '" data-sha="' + sha + '">' + CME.icone('shield') + 'Verificar agora</button>' : '') +
          '</div><p class="verify-result" role="status" aria-live="polite"></p>' +
          '<p class="tiny">No computador: Windows — <code>certutil -hashfile arquivo.pdf SHA256</code>; Linux/macOS — <code>sha256sum arquivo.pdf</code>.</p>';
      }
      if (fonte) html += '<p class="fonte">' + CME.esc(fonte) + '</p>';
      html += '</details>';
    }
    return html + '</article></li>';
  };

  function hexDe(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
    return s;
  }
  function verificar(botao) {
    var saida = botao.closest('details').querySelector('.verify-result');
    var esperado = botao.getAttribute('data-sha');
    if (!window.crypto || !window.crypto.subtle || !window.isSecureContext) {
      saida.textContent = 'Este navegador não permite calcular o código aqui. Use o comando indicado abaixo.';
      return;
    }
    saida.textContent = 'Calculando…';
    botao.disabled = true;
    fetch(botao.getAttribute('data-verificar'), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.arrayBuffer(); })
      .then(function (buf) { return window.crypto.subtle.digest('SHA-256', buf); })
      .then(function (h) {
        var calc = hexDe(h);
        saida.textContent = calc === esperado
          ? 'Conferido: o arquivo publicado corresponde ao código SHA-256 informado.'
          : 'Atenção: o arquivo obtido não corresponde ao código informado (código calculado: ' + calc + ').';
      })
      .catch(function () { saida.textContent = 'Não foi possível baixar o arquivo para conferência. Use o comando indicado abaixo.'; })
      .then(function () { botao.disabled = false; });
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('[data-copiar]');
    if (c) { CME.copiar(c.getAttribute('data-copiar'), c); return; }
    var v = e.target.closest && e.target.closest('[data-verificar]');
    if (v) verificar(v);
  });

  function opcoes(valores, rotulos, todos) {
    return '<option value="">' + CME.esc(todos) + '</option>' + valores.map(function (v) {
      return '<option value="' + CME.esc(v) + '">' + CME.esc(rotulos ? (rotulos[v] || v) : v) + '</option>';
    }).join('');
  }

  /* opts: {alvo: elemento, categorias: [..], rotuloVazio, idPrefixo, filtroTipo: bool} */
  CME.listaDocumentos = function (opts) {
    var alvo = opts.alvo;
    if (!alvo) return Promise.resolve([]);
    var pref = opts.idPrefixo || 'f';
    alvo.innerHTML = '<p class="tiny" role="status">Carregando documentos…</p>';
    return CME.carregar('data/documentos.json').then(function (res) {
      var docs = CME.lista(res).filter(function (d) {
        return d && d.id != null && opts.categorias.indexOf(d.categoria) !== -1;
      });
      if (!docs.length) {
        CME.vazio(alvo, opts.rotuloVazio || 'Nenhum documento publicado nesta seção ainda.');
        return docs;
      }
      var anos = [], status = [], tipos = [];
      docs.forEach(function (d) {
        var a = anoDoc(d);
        if (a && anos.indexOf(a) === -1) anos.push(a);
        if (d.status && status.indexOf(d.status) === -1) status.push(d.status);
        if (tipos.indexOf(d.categoria) === -1) tipos.push(d.categoria);
      });
      anos.sort().reverse();
      var rotTipos = {};
      tipos.forEach(function (t) { rotTipos[t] = (CME.CATEGORIAS[t] || CME.CATEGORIAS.outros).rotulo; });
      var mostrarTipo = tipos.length > 1;

      alvo.innerHTML =
        '<form class="filters" role="search" aria-label="Filtrar documentos" onsubmit="return false">' +
        '<div class="field"><label for="' + pref + '-q">Buscar nesta lista</label>' +
        '<input type="search" id="' + pref + '-q" autocomplete="off" placeholder="Título, número, assunto…"></div>' +
        '<div class="field"><label for="' + pref + '-ano">Ano</label><select id="' + pref + '-ano">' + opcoes(anos, null, 'Todos') + '</select></div>' +
        (mostrarTipo ? '<div class="field"><label for="' + pref + '-tipo">Tipo</label><select id="' + pref + '-tipo">' + opcoes(tipos, rotTipos, 'Todos') + '</select></div>' : '') +
        '<div class="field"><label for="' + pref + '-st">Situação</label><select id="' + pref + '-st">' + opcoes(status, CME.STATUS_DOC, 'Todas') + '</select></div>' +
        '<div class="field"><label for="' + pref + '-ord">Ordenar por</label><select id="' + pref + '-ord">' +
        '<option value="data-desc">Mais recentes</option><option value="data-asc">Mais antigos</option>' +
        '<option value="titulo">Título (A–Z)</option><option value="numero">Número</option></select></div>' +
        '<div class="field"><button type="reset" class="btn ghost small">Limpar filtros</button></div>' +
        '</form><p class="result-count" role="status" aria-live="polite"></p><ul class="doc-list"></ul>';

      var q = alvo.querySelector('#' + pref + '-q');
      var fAno = alvo.querySelector('#' + pref + '-ano');
      var fTipo = alvo.querySelector('#' + pref + '-tipo');
      var fSt = alvo.querySelector('#' + pref + '-st');
      var fOrd = alvo.querySelector('#' + pref + '-ord');
      var cont = alvo.querySelector('.result-count');
      var ul = alvo.querySelector('.doc-list');
      q.value = CME.parametro('q');

      function aplicar() {
        var termos = CME.termos(q.value);
        var lista = docs.filter(function (d) {
          if (fAno.value && anoDoc(d) !== fAno.value) return false;
          if (fTipo && fTipo.value && d.categoria !== fTipo.value) return false;
          if (fSt.value && d.status !== fSt.value) return false;
          if (termos.length) {
            var chave = CME.normalizar([d.titulo, d.numero, d.ano, d.assunto, d.emissor, d.observacao,
              CME.formatarData(d.data)].join(' '));
            for (var i = 0; i < termos.length; i++) if (chave.indexOf(termos[i]) === -1) return false;
          }
          return true;
        });
        var o = fOrd.value;
        lista.sort(function (a, b) {
          if (o === 'titulo') return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
          if (o === 'numero') return (anoDoc(a) || '').localeCompare(anoDoc(b) || '') || numeroOrdenavel(a.numero) - numeroOrdenavel(b.numero);
          var da = CME.dataValida(a.data) ? a.data : '', db = CME.dataValida(b.data) ? b.data : '';
          if (da === db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return o === 'data-asc' ? (da < db ? -1 : 1) : (da < db ? 1 : -1);
        });
        cont.textContent = lista.length === docs.length
          ? docs.length + (docs.length === 1 ? ' documento' : ' documentos')
          : lista.length + ' de ' + docs.length + ' documentos';
        ul.innerHTML = lista.length ? lista.map(function (d) { return CME.cartaoDocumento(d, termos, 3); }).join('')
          : '<li class="empty-state"><p>Nenhum documento corresponde aos filtros escolhidos.</p></li>';
      }
      [fAno, fTipo, fSt, fOrd].forEach(function (s) { if (s) s.addEventListener('change', aplicar); });
      var timer;
      q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(aplicar, 120); });
      alvo.querySelector('form').addEventListener('reset', function () { setTimeout(aplicar, 0); });
      aplicar();
      return docs;
    });
  };

  /* Inicialização declarativa: <div data-lista-documentos="cat1,cat2" data-vazio="..."> */
  CME.pronto(function () {
    var alvos = document.querySelectorAll('[data-lista-documentos]');
    var promessas = Array.prototype.map.call(alvos, function (el, i) {
      return CME.listaDocumentos({
        alvo: el,
        categorias: el.getAttribute('data-lista-documentos').split(',').map(function (s) { return s.trim(); }),
        rotuloVazio: el.getAttribute('data-vazio'),
        idPrefixo: el.getAttribute('data-prefixo') || ('f' + i)
      });
    });
    if (promessas.length) Promise.all(promessas).then(function () { setTimeout(CME.focarAlvo, 0); });
  });
})();
