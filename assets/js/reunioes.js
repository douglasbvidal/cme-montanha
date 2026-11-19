/* CME Montanha — reuniões: abas (Pautas e convocações, Atas, Calendário), calendário mensal e lista.
   Cada reunião tem âncora estável #reuniao-<id> (id do reunioes.json ou data + tipo). */
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
        try { history.replaceState(null, '', '?aba=' + t.getAttribute('data-aba') + window.location.hash); } catch (e) { /* file:// */ }
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
    if (/^#reuniao-/.test(window.location.hash)) pedida = 'calendario';
    var inicial = tabs.filter(function (t) { return t.getAttribute('data-aba') === pedida; })[0] ||
      tabs.filter(function (t) { return t.getAttribute('data-padrao') === 'true'; })[0] || tabs[0];
    selecionar(inicial, false);
  };

  function docPorId(docs) {
    var m = {};
    docs.forEach(function (d) { if (d && d.id != null) m[String(d.id)] = d; });
    return m;
  }

  /* Link de um documento ligado à reunião: PDF hospedado, link oficial ou ficha. */
  function linkDoc(d, rotulo) {
    if (CME.ehExterno(d)) {
      return '<a class="btn small ghost" href="' + CME.esc(d.url) + '" target="_blank" rel="noopener">' + CME.icone('external') +
        '<span>' + CME.esc(rotulo) + ' no site oficial <span aria-hidden="true">↗</span><span class="sr-only">(abre em nova aba)</span></span></a>';
    }
    var href = CME.hrefArquivo(d.arquivo);
    var det = [CME.tamanho(d.tamanho_kb), CME.paginas(d.paginas)].filter(Boolean).join(', ');
    if (d.paginas_no_arquivo) det = [det, CME.texto(d.paginas_no_arquivo)].filter(Boolean).join(', ');
    return href
      ? '<a class="btn small ghost" href="' + CME.esc(href) + '">' + CME.icone('doc') + '<span>' + CME.esc(rotulo) +
        ' (PDF' + (det ? ', ' + CME.esc(det) : '') + ')</span></a>'
      : '<a class="btn small ghost" href="' + CME.esc(CME.linkPagina(d)) + '">' + CME.icone('doc') + '<span>' + CME.esc(rotulo) + '</span></a>';
  }

  /* Documentos da reunião: convocação, pauta, ata, relacionados e documentos que apontam para ela (reuniao_id). */
  function documentosDaReuniao(r, id, mapa, todos) {
    var itens = [], vistos = {};
    function add(docId, rotulo) {
      if (docId == null || docId === '') return;
      var d = mapa[String(docId)];
      if (!d || vistos[d.id]) return;
      vistos[d.id] = true;
      itens.push({ d: d, rotulo: rotulo });
    }
    add(r.convocacao_id, 'Convocação');
    add(r.pauta_id, 'Pauta');
    add(r.ata_id, 'Ata');
    (Array.isArray(r.documentos_relacionados) ? r.documentos_relacionados : []).forEach(function (x) {
      var d = mapa[String(x)];
      if (d) add(x, (CME.CATEGORIAS[d.categoria] || CME.CATEGORIAS.outros).rotulo + ': ' + (d.titulo || ''));
    });
    todos.forEach(function (d) {
      if (d && d.reuniao_id != null && String(d.reuniao_id) === id) {
        add(d.id, d.categoria === 'pautas' ? 'Pauta' : d.categoria === 'atas' ? 'Ata' : d.categoria === 'convocacoes' ? 'Convocação'
          : (CME.CATEGORIAS[d.categoria] || CME.CATEGORIAS.outros).rotulo + ': ' + (d.titulo || ''));
      }
    });
    return itens;
  }

  function notaAusencia(r, itens) {
    var tem = function (cat) { return itens.some(function (x) { return x.d.categoria === cat; }); };
    var hoje = CME.hojeISO();
    switch (r.status) {
      case 'sem_registro': return 'Não há registro de realização desta reunião; por isso não há pauta nem ata.';
      case 'cancelada': return itens.length ? '' : 'Reunião cancelada: não há pauta nem ata.';
      case 'prevista':
      case 'convocada':
        if (r.data >= hoje) return tem('pautas') ? '' : 'A pauta será publicada aqui quando estiver disponível.';
        break;
    }
    var faltam = [];
    if (!tem('pautas')) faltam.push('pauta');
    if (!tem('atas')) faltam.push('ata');
    if (!faltam.length) return '';
    var txt = (faltam.length === 2 ? 'Pauta e ata ainda não publicadas' : (faltam[0] === 'ata' ? 'Ata ainda não publicada' : 'Pauta não publicada')) + ' neste portal.';
    if (faltam.indexOf('ata') !== -1) txt += ' As atas são publicadas depois de aprovadas pelo Plenário.';
    return txt;
  }

  function cartaoReuniao(r, id, mapa, todos) {
    var st = CME.STATUS_REUNIAO[r.status];
    var cab = '<div class="meeting-date">' + CME.esc(CME.formatarData(r.data)) + '<small>' + CME.esc(CME.diaSemana(r.data)) + '</small></div>';
    var titulo = CME.rotuloReuniao(r) + (r.numero && r.reservada !== true ? ' nº ' + r.numero : '');
    var selo = st ? '<span class="badge ' + CME.esc(r.status) + '"><span class="sr-only">Situação: </span>' + CME.esc(st) + '</span>' : '';
    var html = '<li><article class="meeting" id="reuniao-' + CME.esc(id) + '" aria-labelledby="reuniao-' + CME.esc(id) + '-t">' + cab +
      '<div><h3 id="reuniao-' + CME.esc(id) + '-t">' + CME.esc(titulo) + '</h3><p>' + selo + '</p>';
    if (r.reservada === true) {
      return html + '<p class="tiny">Reunião de caráter reservado: pauta, ata e demais detalhes não são publicados neste site.</p></div></article></li>';
    }
    var info = [];
    var hor = CME.horario(r.horario);
    if (hor) info.push(['Horário', hor.texto]);
    if (CME.MODALIDADES[r.modalidade]) info.push(['Modalidade', CME.MODALIDADES[r.modalidade]]);
    if (r.local) info.push(['Local', r.local]);
    if (info.length) {
      html += '<dl class="doc-meta">' + info.map(function (x) {
        return '<div><dt>' + CME.esc(x[0]) + ':</dt><dd>' + CME.esc(x[1]) + '</dd></div>';
      }).join('') + '</dl>';
    }
    if (r.observacao_publica) html += '<p class="doc-obs">' + CME.esc(r.observacao_publica) + '</p>';
    var itens = documentosDaReuniao(r, id, mapa, todos);
    if (itens.length) html += '<div class="doc-actions">' + itens.map(function (x) { return linkDoc(x.d, x.rotulo); }).join('') + '</div>';
    var nota = notaAusencia(r, itens);
    if (nota) html += '<p class="tiny">' + CME.esc(nota) + '</p>';
    return html + '</div></article></li>';
  }

  /* ---------- Calendário mensal ---------- */
  function montarCalendario(el, itens) {
    var porDia = {};
    itens.forEach(function (o) { (porDia[o.r.data] = porDia[o.r.data] || []).push(o); });
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
      '<p class="tiny">Use os botões ‹ e › para mudar de mês. Clique em uma reunião para ver os detalhes na lista abaixo.</p>';
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
            return '<a class="ev-link" href="#reuniao-' + CME.esc(e.id) + '" aria-label="' + CME.esc(CME.rotuloReuniao(e.r) + ' em ' + CME.dataExtenso(iso) + (st ? ', ' + st.toLowerCase() : '') + ': ver detalhes') + '">Reunião</a>';
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

  /* Lista completa com ids estáveis (calculados sobre a lista inteira, como no gerar_ics.py). */
  function reunioesComId(lista) {
    var ids = CME.idsReunioes(lista);
    return lista.map(function (r, i) { return { r: r, id: ids[i] }; })
      .filter(function (o) { return o.r && CME.dataValida(o.r.data); });
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
      var itens = reunioesComId(CME.lista(r[0]));
      var todos = CME.lista(r[1]);
      var mapa = docPorId(todos);
      if (!itens.length) {
        CME.vazio(calEl, 'Nenhuma reunião publicada ainda.');
        CME.vazio(listaEl, 'Nenhuma reunião publicada ainda.');
        return;
      }
      montarCalendario(calEl, itens);
      var hoje = CME.hojeISO();
      var prox = itens.filter(function (o) { return o.r.data >= hoje && o.r.status !== 'realizada'; })
        .sort(function (a, b) { return a.r.data < b.r.data ? -1 : a.r.data > b.r.data ? 1 : 0; });
      var pass = itens.filter(function (o) { return prox.indexOf(o) === -1; })
        .sort(function (a, b) { return a.r.data < b.r.data ? 1 : a.r.data > b.r.data ? -1 : 0; });
      function ul(l) { return '<ul class="meeting-list">' + l.map(function (o) { return cartaoReuniao(o.r, o.id, mapa, todos); }).join('') + '</ul>'; }
      var html = '<h3>Próximas reuniões</h3>' + (prox.length ? ul(prox) : '<div class="empty-state"><p>Nenhuma reunião futura publicada.</p></div>');
      html += '<h3 style="margin-top:1.4em">Reuniões anteriores</h3>' + (pass.length ? ul(pass) : '<div class="empty-state"><p>Nenhuma reunião anterior publicada.</p></div>');
      listaEl.innerHTML = html;
      setTimeout(CME.focarAlvo, 0);
    });
  }

  /* Próximas reuniões na página inicial (cartão compacto com link para o cartão completo) */
  CME.proximasReunioes = function (el, limite) {
    if (!el) return;
    CME.carregar('data/reunioes.json').then(function (res) {
      var hoje = CME.hojeISO();
      var lista = reunioesComId(CME.lista(res))
        .filter(function (o) { return o.r.data >= hoje && (o.r.status === 'prevista' || o.r.status === 'convocada'); })
        .sort(function (a, b) { return a.r.data < b.r.data ? -1 : a.r.data > b.r.data ? 1 : 0; }).slice(0, limite || 2);
      if (!lista.length) { CME.vazio(el, 'Nenhuma reunião prevista publicada no momento.'); return; }
      el.innerHTML = '<ul class="meeting-list compact">' + lista.map(function (o) {
        var st = CME.STATUS_REUNIAO[o.r.status];
        return '<li><a class="meeting-mini" href="' + CME.esc(CME.linkReuniao(o.id)) + '">' +
          '<span class="meeting-date">' + CME.esc(CME.formatarData(o.r.data)) + '<small>' + CME.esc(CME.diaSemana(o.r.data)) + '</small></span>' +
          '<span><strong>' + CME.esc(CME.rotuloReuniao(o.r)) + '</strong>' +
          (st ? ' <span class="badge ' + CME.esc(o.r.status) + '">' + CME.esc(st) + '</span>' : '') +
          (o.r.reservada !== true && CME.horario(o.r.horario) ? '<span class="tiny" style="display:block">Horário: ' + CME.esc(CME.horario(o.r.horario).texto) + '</span>' : '') +
          (o.r.reservada !== true && o.r.local ? '<span class="tiny" style="display:block">Local: ' + CME.esc(o.r.local) + '</span>' : '') +
          '</span></a></li>';
      }).join('') + '</ul>';
    });
  };

  CME.reunioesComId = reunioesComId;
  CME.pronto(iniciar);
})();
