/* CME Montanha — listagem de documentos com filtros, busca, ordenação e verificação SHA-256.
   Campos opcionais (estado_*, datas de publicação/indexação, relações) são exibidos só quando existem. */
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
  CME.anoDoc = anoDoc;

  /* Contexto compartilhado: documentos por id e reuniões por id (para links de relação). */
  CME.contextoDocs = { docs: {}, reunioes: {} };
  CME.prepararContexto = function () {
    return Promise.all([CME.carregar('data/documentos.json'), CME.carregar('data/reunioes.json')]).then(function (r) {
      var docs = {}, reun = {};
      CME.lista(r[0]).forEach(function (d) { if (d && d.id != null) docs[String(d.id)] = d; });
      var lista = CME.lista(r[1]);
      var ids = CME.idsReunioes(lista);
      lista.forEach(function (x, i) { if (x) reun[ids[i]] = x; });
      CME.contextoDocs = { docs: docs, reunioes: reun };
      return CME.contextoDocs;
    });
  };

  function linkRelacionado(id) {
    var ctx = CME.contextoDocs, d = ctx.docs[String(id)];
    if (!d) return '';
    var cat = CME.CATEGORIAS[d.categoria] || CME.CATEGORIAS.outros;
    return '<li><a href="' + CME.esc(CME.linkPagina(d)) + '">' + CME.esc(d.titulo || cat.rotulo) + '</a>' +
      ' <span class="tiny">(' + CME.esc(cat.rotulo) + ')</span></li>';
  }
  function linkReuniaoDoc(rid) {
    var r = CME.contextoDocs.reunioes[String(rid)];
    if (!r) return '';
    var texto = CME.rotuloReuniao(r) + ' de ' + CME.formatarData(r.data);
    return '<a href="' + CME.esc(CME.linkReuniao(rid)) + '">' + CME.esc(texto) + '</a>';
  }

  CME.cartaoDocumento = function (d, termos, nivelTitulo) {
    var h = 'h' + (nivelTitulo || 3);
    var cat = CME.CATEGORIAS[d.categoria] || CME.CATEGORIAS.outros;
    var externo = CME.ehExterno(d);
    var href = externo ? null : CME.hrefArquivo(d.arquivo);
    var detalhes = [CME.tamanho(d.tamanho_kb), CME.paginas(d.paginas)].filter(Boolean).join(', ');
    var estados = CME.estadosDoc(d);
    var status = estados.length ? '' : CME.STATUS_DOC[d.status]; /* status antigo é o fallback */
    var id = 'doc-' + String(d.id);
    var meta = [];
    if (d.numero) meta.push(['Número', d.numero]);
    meta.push(['Data do documento', CME.formatarData(d.data)]);
    if (CME.dataValida(d.data_publicacao_oficial)) {
      meta.push(['Publicação oficial', CME.formatarData(d.data_publicacao_oficial) +
        (d.fonte_publicacao_oficial ? ' — ' + CME.texto(d.fonte_publicacao_oficial) : '')]);
    } else if (d.fonte_publicacao_oficial) {
      meta.push(['Publicação oficial', CME.texto(d.fonte_publicacao_oficial)]);
    }
    if (CME.dataValida(d.data_indexacao)) meta.push(['Incluído neste portal em', CME.formatarData(d.data_indexacao)]);
    if (d.emissor) meta.push(['Emissor', d.emissor]);
    if (d.paginas_no_arquivo) meta.push(['Localização no arquivo', CME.texto(d.paginas_no_arquivo)]);
    if (d.natureza_pauta === 'original' || d.natureza_pauta === 'reproducao_digital') {
      meta.push(['Natureza', d.natureza_pauta === 'original' ? 'Documento original' : 'Reprodução digital']);
    }
    var sha = typeof d.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(d.sha256) ? d.sha256.toLowerCase() : '';
    var fonte = CME.fontePublica(d.fonte_original);
    var t = termos || [];
    var urlPub = CME.urlExterna(d.url_publicacao_oficial);
    if (urlPub && externo && urlPub === d.url) urlPub = null;

    var html = '<li><article class="doc-card" id="' + CME.esc(id) + '" aria-labelledby="' + CME.esc(id) + '-t">' +
      '<div class="doc-top">' +
      (status ? '<span class="badge ' + CME.esc(d.status) + '"><span class="sr-only">Situação: </span>' + CME.esc(status) + '</span>' : '') +
      '<span class="badge tipo">' + CME.esc(cat.rotulo) + '</span>' +
      (externo ? '<span class="badge externo">' + CME.esc(CME.ROTULO_EXTERNO) + '</span>' : '') + '</div>' +
      '<' + h + ' id="' + CME.esc(id) + '-t">' + CME.realcar(d.titulo || 'Documento sem título', t) + '</' + h + '>' +
      (estados.length ? '<ul class="doc-estados" aria-label="Situação do documento">' + estados.map(function (e) {
        return '<li class="badge tom-' + e.tom + '">' + CME.esc(e.rotulo) + ': ' + CME.esc(e.texto) + '</li>';
      }).join('') + '</ul>' : '') +
      (d.assunto ? '<p class="assunto">' + CME.realcar(d.assunto, t) + '</p>' : '') +
      '<dl class="doc-meta">' + meta.map(function (m) {
        return '<div><dt>' + CME.esc(m[0]) + ':</dt><dd>' + CME.realcar(m[1], t) + '</dd></div>';
      }).join('') + '</dl>';
    var rel = d.reuniao_id != null ? linkReuniaoDoc(d.reuniao_id) : '';
    if (rel) html += '<p class="doc-rel">Reunião: ' + rel + '</p>';
    var relDocs = Array.isArray(d.documento_relacionado) ? d.documento_relacionado.map(linkRelacionado).filter(Boolean) : [];
    if (relDocs.length) html += '<div class="doc-rel"><span>Documentos relacionados:</span><ul>' + relDocs.join('') + '</ul></div>';
    if (d.observacao) html += '<p class="doc-obs"><strong>Observação:</strong> ' + CME.realcar(d.observacao, t) + '</p>';
    if (d.observacao_publica && d.observacao_publica !== d.observacao) {
      html += '<p class="doc-obs"><strong>Observação:</strong> ' + CME.realcar(d.observacao_publica, t) + '</p>';
    }
    if (d.pendencia_verificacao) {
      html += '<p class="doc-obs pendencia"><strong>Pendente de verificação:</strong> ' + CME.realcar(d.pendencia_verificacao, t) + '</p>';
    }
    html += '<div class="doc-actions">' +
      (externo ? '<a class="btn small" href="' + CME.esc(d.url) + '" target="_blank" rel="noopener">' + CME.icone('external') +
        '<span>Abrir no site oficial <span aria-hidden="true">↗</span><span class="sr-only">(abre em nova aba)</span></span></a>'
      : href ? '<a class="btn small" href="' + CME.esc(href) + '" download>' + CME.icone('download') +
        '<span>Baixar PDF' + (detalhes ? ' <span class="tiny" style="color:inherit">(' + CME.esc(detalhes) + ')</span>' : '') + '</span></a>' +
        '<a class="btn small ghost" href="' + CME.esc(href) + '">' + CME.icone('doc') + '<span>Abrir no navegador</span></a>'
        : '<span class="tiny">Arquivo indisponível no momento.</span>') +
      (urlPub ? '<a class="btn small ghost" href="' + CME.esc(urlPub) + '" target="_blank" rel="noopener">' + CME.icone('external') +
        '<span>Ver publicação oficial <span aria-hidden="true">↗</span><span class="sr-only">(abre em nova aba)</span></span></a>' : '') +
      '</div>';
    if (externo) sha = '';
    if (sha || fonte) {
      html += '<details class="integridade"><summary>' + CME.icone(sha ? 'shield' : 'info') +
        (sha ? 'Verificar integridade (SHA-256)' : 'Fonte do registro') + '</summary>';
      if (sha) {
        html += '<p class="tiny">O código abaixo identifica exatamente este arquivo. Se o arquivo baixado gerar o mesmo código, ele não foi alterado.</p>' +
          '<code class="hash">' + sha + '</code>' +
          '<div class="doc-actions"><button type="button" class="btn small ghost" data-copiar="' + sha + '">' + CME.icone('copy') + '<span data-rotulo>Copiar código</span></button>' +
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
    if (c) { CME.copiar(c.getAttribute('data-copiar'), c, 'Código copiado.'); return; }
    var v = e.target.closest && e.target.closest('[data-verificar]');
    if (v) verificar(v);
  });

  function opcoes(valores, rotulos, todos) {
    return '<option value="">' + CME.esc(todos) + '</option>' + valores.map(function (v) {
      var r = rotulos ? rotulos[v] : v;
      if (Array.isArray(r)) r = r[0];
      return '<option value="' + CME.esc(v) + '">' + CME.esc(r || v) + '</option>';
    }).join('');
  }
  function campoSelect(id, rotulo, html) {
    return '<div class="field"><label for="' + id + '">' + CME.esc(rotulo) + '</label><select id="' + id + '">' + html + '</select></div>';
  }

  /* opts: {alvo: elemento, categorias: [..], rotuloVazio, idPrefixo} */
  CME.listaDocumentos = function (opts) {
    var alvo = opts.alvo;
    if (!alvo) return Promise.resolve([]);
    var pref = opts.idPrefixo || 'f';
    alvo.innerHTML = '<p class="tiny" role="status">Carregando documentos…</p>';
    return CME.prepararContexto().then(function () {
      return CME.carregar('data/documentos.json');
    }).then(function (res) {
      var docs = CME.lista(res).filter(function (d) {
        return d && d.id != null && opts.categorias.indexOf(d.categoria) !== -1;
      });
      if (!docs.length) {
        CME.vazio(alvo, opts.rotuloVazio || 'Nenhum documento publicado nesta seção ainda.');
        return docs;
      }
      var anos = [], status = [], tipos = [], estadosUsados = {};
      var todosComEstado = true;
      docs.forEach(function (d) {
        var a = anoDoc(d);
        if (a && anos.indexOf(a) === -1) anos.push(a);
        if (d.status && CME.STATUS_DOC[d.status] && status.indexOf(d.status) === -1) status.push(d.status);
        if (tipos.indexOf(d.categoria) === -1) tipos.push(d.categoria);
        if (!CME.temEstado(d)) todosComEstado = false;
        CME.ESTADOS.forEach(function (e) {
          var v = d[e.campo];
          if (typeof v === 'string' && e.valores[v]) {
            var l = estadosUsados[e.campo] = estadosUsados[e.campo] || [];
            if (l.indexOf(v) === -1) l.push(v);
          }
        });
      });
      anos.sort().reverse();
      var rotTipos = {};
      tipos.forEach(function (t) { rotTipos[t] = (CME.CATEGORIAS[t] || CME.CATEGORIAS.outros).rotulo; });
      var mostrarTipo = tipos.length > 1;
      var mostrarStatus = status.length > 0 && !todosComEstado;
      var filtrosEstado = CME.ESTADOS.filter(function (e) { return estadosUsados[e.campo]; });

      alvo.innerHTML =
        '<form class="filters" role="search" aria-label="Filtrar documentos" onsubmit="return false">' +
        '<div class="field"><label for="' + pref + '-q">Buscar nesta lista</label>' +
        '<input type="search" id="' + pref + '-q" autocomplete="off" placeholder="Título, número, assunto…"></div>' +
        campoSelect(pref + '-ano', 'Ano', opcoes(anos, null, 'Todos')) +
        (mostrarTipo ? campoSelect(pref + '-tipo', 'Tipo', opcoes(tipos, rotTipos, 'Todos')) : '') +
        (mostrarStatus ? campoSelect(pref + '-st', 'Situação', opcoes(status, CME.STATUS_DOC, 'Todas')) : '') +
        filtrosEstado.map(function (e) {
          return campoSelect(pref + '-' + e.campo, e.rotulo, opcoes(estadosUsados[e.campo], e.valores, 'Todos'));
        }).join('') +
        campoSelect(pref + '-ord', 'Ordenar por', '<option value="data-desc">Mais recentes</option><option value="data-asc">Mais antigos</option>' +
          '<option value="titulo">Título (A–Z)</option><option value="numero">Número</option>') +
        '<div class="field"><button type="reset" class="btn ghost small">Limpar filtros</button></div>' +
        '</form><p class="result-count" role="status" aria-live="polite"></p><ul class="doc-list"></ul>';

      var q = alvo.querySelector('#' + pref + '-q');
      var fAno = alvo.querySelector('#' + pref + '-ano');
      var fTipo = alvo.querySelector('#' + pref + '-tipo');
      var fSt = alvo.querySelector('#' + pref + '-st');
      var fOrd = alvo.querySelector('#' + pref + '-ord');
      var fEst = filtrosEstado.map(function (e) { return { campo: e.campo, el: alvo.querySelector('#' + pref + '-' + e.campo) }; });
      var cont = alvo.querySelector('.result-count');
      var ul = alvo.querySelector('.doc-list');
      q.value = CME.parametro('q');

      function aplicar() {
        var termos = CME.termos(q.value);
        var lista = docs.filter(function (d) {
          if (fAno.value && anoDoc(d) !== fAno.value) return false;
          if (fTipo && fTipo.value && d.categoria !== fTipo.value) return false;
          if (fSt && fSt.value && d.status !== fSt.value) return false;
          for (var k = 0; k < fEst.length; k++) if (fEst[k].el.value && d[fEst[k].campo] !== fEst[k].el.value) return false;
          if (termos.length) {
            var chave = CME.normalizar([d.titulo, d.numero, d.ano, d.assunto, d.emissor, d.observacao, d.observacao_publica,
              d.fonte_publicacao_oficial, CME.variantesNumero([d.numero, d.titulo].join(' ')),
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
      [fAno, fTipo, fSt, fOrd].concat(fEst.map(function (x) { return x.el; })).forEach(function (s) { if (s) s.addEventListener('change', aplicar); });
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
