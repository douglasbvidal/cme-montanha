/* CME Montanha — reuniões: abas (Pautas, Atas, Calendário), calendário mensal e lista. */
(function () {
  'use strict';
  var CME = window.CME;
  if (!CME) return;

  /* ---------- Abas acessíveis (padrão WAI-ARIA, ativação automática) ---------- */
  CME.iniciarAbas = function (container) {
    var tabs = Array.prototype.slice.call(container.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
    function selecionar(tab, focar) {
      tabs.forEach(function (t) {
        var sel = t === tab;
        t.setAttribute('aria-selected', sel ? 'true' : 'false');
        t.tabIndex = sel ? 0 : -1;
        var p = document.getElementById(t.getAttribute('aria-controls'));
        if (p) p.hidden = !sel;
      });
      if (focar) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        selecionar(t, false);
        try { history.replaceState(null, '', '?aba=' + t.getAttribute('data-aba')); } catch (e) { /* file:// */ }
      });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); selecionar(n, true); }
      });
    });
    var pedida = CME.parametro('aba');
    var inicial = tabs.filter(function (t) { return t.getAttribute('data-aba') === pedida; })[0] ||
      tabs.filter(function (t) { return t.getAttribute('data-padrao') === 'true'; })[0] || tabs[0];
    selecionar(inicial, false);
  };

  function docPorId(docs) {
    var m = {};
    docs.forEach(function (d) { if (d && d.id != null) m[String(d.id)] = d; });
    return m;
  }
  function idReuniao(r, i) { return 'reuniao-' + (CME.dataValida(r.data) ? r.data : 'sem-data') + '-' + (i + 1); }
  function rotuloTipo(r) {
    var t = CME.rotuloTipoReuniao(r.tipo);
    if (!t) return 'Reunião';
    return /reuni/i.test(t) ? t : 'Reunião ' + t.toLowerCase();
  }

  function linkDoc(id, mapa, rotulo) {
    if (id == null || id === '') return '<span class="tiny">' + CME.esc(rotulo) + ' não publicada.</span>';
    var d = mapa[String(id)];
    if (!d) return '<span class="tiny">' + CME.esc(rotulo) + ' não publicada.</span>';
    if (CME.ehExterno(d)) {
      return '<a class="btn small ghost" href="' + CME.esc(d.url) + '" target="_blank" rel="noopener">' + CME.icone('external') +
        '<span>' + CME.esc(rotulo) + ' no site oficial <span aria-hidden="true">↗</span><span class="sr-only">(abre em nova aba)</span></span></a>';
    }
    var href = CME.hrefArquivo(d.arquivo);
    var det = [CME.tamanho(d.tamanho_kb), CME.paginas(d.paginas)].filter(Boolean).join(', ');
    return href
      ? '<a class="btn small ghost" href="' + CME.esc(href) + '">' + CME.icone('doc') + '<span>' + CME.esc(rotulo) +
        ' (PDF' + (det ? ', ' + CME.esc(det) : '') + ')</span></a>'
      : '<a class="btn small ghost" href="' + CME.esc(CME.linkPagina(d)) + '">' + CME.esc(rotulo) + '</a>';
  }

  function cartaoReuniao(r, i, mapa) {
    var st = CME.STATUS_REUNIAO[r.status];
    return '<li><article class="meeting" id="' + idReuniao(r, i) + '">' +
      '<div class="meeting-date">' + CME.esc(CME.formatarData(r.data)) + '<small>' + CME.esc(CME.diaSemana(r.data)) + '</small></div>' +
      '<div><h3>' + CME.esc(rotuloTipo(r)) + (r.numero ? ' nº ' + CME.esc(r.numero) : '') + '</h3>' +
      '<p>' + (st ? '<span class="badge ' + CME.esc(r.status) + '"><span class="sr-only">Situação: </span>' + CME.esc(st) + '</span> ' : '') +
      (r.local ? '<span class="muted">Local: ' + CME.esc(r.local) + '</span>' : '') + '</p>' +
      (r.observacao_publica ? '<p class="doc-obs">' + CME.esc(r.observacao_publica) + '</p>' : '') +
      (r.reservada === true ? '<p class="tiny">Reunião de caráter reservado: pauta e ata não são publicadas neste site.</p>'
        : '<div class="doc-actions">' + linkDoc(r.pauta_id, mapa, 'Pauta') + linkDoc(r.ata_id, mapa, 'Ata') + '</div>') +
      '</div></article></li>';
  }

  /* ---------- Calendário mensal ---------- */
  function montarCalendario(el, reunioes) {
    var porDia = {};
    reunioes.forEach(function (r, i) {
      if (!CME.dataValida(r.data)) return;
      (porDia[r.data] = porDia[r.data] || []).push({ r: r, id: idReuniao(r, i) });
    });
    var hoje = CME.hojeISO();
    var futuras = Object.keys(porDia).filter(function (d) { return d >= hoje; }).sort();
    var base = CME.dataObj(futuras[0] || hoje);
    var ano = base.getFullYear(), mes = base.getMonth();

    el.innerHTML = '<div class="cal-head">' +
      '<button type="button" class="icon-button" data-mes="-1" aria-label="Mês anterior">‹</button>' +
      '<h3 aria-live="polite"></h3>' +
      '<button type="button" class="icon-button" data-mes="1" aria-label="Próximo mês">›</button></div>' +
      '<div class="table-wrap"><table class="calendar"><thead><tr>' +
      ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(function (d, i) {
        return '<th scope="col"><abbr title="' + CME.DIAS[i] + '">' + d + '</abbr></th>';
      }).join('') + '</tr></thead><tbody></tbody></table></div>' +
      '<p class="tiny">Use os botões ‹ e › para mudar de mês. Dias com reunião têm um link para os detalhes na lista abaixo.</p>';
    var titulo = el.querySelector('h3');
    var tbody = el.querySelector('tbody');
    function z(n) { return (n < 10 ? '0' : '') + n; }
    function desenhar() {
      var nome = CME.MESES[mes];
      titulo.textContent = nome.charAt(0).toUpperCase() + nome.slice(1) + ' de ' + ano;
      var primeiro = new Date(ano, mes, 1).getDay();
      var dias = new Date(ano, mes + 1, 0).getDate();
      var html = '', cel = 0;
      html += '<tr>';
      for (var v = 0; v < primeiro; v++, cel++) html += '<td class="out" aria-hidden="true"></td>';
      for (var d = 1; d <= dias; d++, cel++) {
        if (cel > 0 && cel % 7 === 0) html += '</tr><tr>';
        var iso = ano + '-' + z(mes + 1) + '-' + z(d);
        var evs = porDia[iso] || [];
        var cls = [evs.length ? 'has-event' : '', iso === hoje ? 'today' : ''].filter(Boolean).join(' ');
        html += '<td' + (cls ? ' class="' + cls + '"' : '') + (iso === hoje ? ' aria-current="date"' : '') + '><span class="day-num">' + d + '</span>' +
          evs.map(function (e) {
            var st = CME.STATUS_REUNIAO[e.r.status] || '';
            return '<a class="ev-link" href="#' + e.id + '" aria-label="' + CME.esc(rotuloTipo(e.r) + ' em ' + CME.dataExtenso(iso) + (st ? ', ' + st.toLowerCase() : '')) + '">Reunião</a>';
          }).join('') + '</td>';
      }
      while (cel % 7 !== 0) { html += '<td class="out" aria-hidden="true"></td>'; cel++; }
      tbody.innerHTML = html + '</tr>';
    }
    Array.prototype.forEach.call(el.querySelectorAll('[data-mes]'), function (b) {
      b.addEventListener('click', function () {
        mes += parseInt(b.getAttribute('data-mes'), 10);
        if (mes < 0) { mes = 11; ano--; } else if (mes > 11) { mes = 0; ano++; }
        desenhar();
      });
    });
    desenhar();
  }

  function iniciar() {
    if (CME.pagina !== 'reunioes') return;
    var abas = document.querySelector('[data-abas]');
    if (abas) CME.iniciarAbas(abas);
    var calEl = document.getElementById('calendario-mensal');
    var listaEl = document.getElementById('lista-reunioes');
    var icsEl = document.getElementById('ics-acoes');

    CME.config().then(function (cfg) {
      if (!icsEl) return;
      var url = typeof cfg.url_site === 'string' ? cfg.url_site.trim() : '';
      if (/^https:\/\//i.test(url)) {
        var webcal = url.replace(/^https:\/\//i, 'webcal://').replace(/\/?$/, '/') + 'calendario.ics';
        icsEl.insertAdjacentHTML('beforeend', '<a class="btn ghost" href="' + CME.esc(webcal) + '">' + CME.icone('calendar') +
          '<span>Assinar no aplicativo de agenda</span></a>');
      }
    });

    Promise.all([CME.carregar('data/reunioes.json'), CME.carregar('data/documentos.json')]).then(function (r) {
      var reunioes = CME.lista(r[0]).filter(function (x) { return x && CME.dataValida(x.data); });
      var mapa = docPorId(CME.lista(r[1]));
      if (!reunioes.length) {
        CME.vazio(calEl, 'Nenhuma reunião publicada ainda.');
        CME.vazio(listaEl, 'Nenhuma reunião publicada ainda.');
        return;
      }
      var ordenadas = reunioes.map(function (x, i) { return { r: x, i: i }; });
      montarCalendario(calEl, reunioes);
      var hoje = CME.hojeISO();
      var prox = ordenadas.filter(function (o) { return o.r.data >= hoje && o.r.status !== 'realizada'; })
        .sort(function (a, b) { return a.r.data < b.r.data ? -1 : 1; });
      var pass = ordenadas.filter(function (o) { return prox.indexOf(o) === -1; })
        .sort(function (a, b) { return a.r.data < b.r.data ? 1 : -1; });
      var html = '';
      html += '<h3>Próximas reuniões</h3>' + (prox.length
        ? '<ul class="meeting-list">' + prox.map(function (o) { return cartaoReuniao(o.r, o.i, mapa); }).join('') + '</ul>'
        : '<div class="empty-state"><p>Nenhuma reunião futura publicada.</p></div>');
      html += '<h3 style="margin-top:1.4em">Reuniões anteriores</h3>' + (pass.length
        ? '<ul class="meeting-list">' + pass.map(function (o) { return cartaoReuniao(o.r, o.i, mapa); }).join('') + '</ul>'
        : '<div class="empty-state"><p>Nenhuma reunião anterior publicada.</p></div>');
      listaEl.innerHTML = html;
      setTimeout(CME.focarAlvo, 0);
    });
  }

  /* Próximas reuniões na página inicial */
  CME.proximasReunioes = function (el, limite) {
    if (!el) return;
    Promise.all([CME.carregar('data/reunioes.json'), CME.carregar('data/documentos.json')]).then(function (r) {
      var hoje = CME.hojeISO();
      var mapa = docPorId(CME.lista(r[1]));
      var todas = CME.lista(r[0]);
      var lista = todas.map(function (x, i) { return { r: x, i: i }; })
        .filter(function (o) { return o.r && CME.dataValida(o.r.data) && o.r.data >= hoje && (o.r.status === 'prevista' || o.r.status === 'convocada'); })
        .sort(function (a, b) { return a.r.data < b.r.data ? -1 : 1; }).slice(0, limite || 3);
      if (!lista.length) { CME.vazio(el, 'Nenhuma reunião prevista publicada no momento.'); return; }
      el.innerHTML = '<ul class="meeting-list">' + lista.map(function (o) {
        return cartaoReuniao(o.r, o.i, mapa).replace('id="reuniao-', 'data-ref="reuniao-');
      }).join('') + '</ul>';
    });
  };

  CME.pronto(iniciar);
})();
