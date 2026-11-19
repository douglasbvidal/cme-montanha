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
    CME.proximasReunioes && CME.proximasReunioes($('home-reunioes'), 2);
    var el = $('home-documentos');
    if (!el) return;
    CME.carregar('data/documentos.json').then(function (res) {
      /* ordem: data de inclusão no portal (data_indexacao), quando existir; senão, data do documento */
      function chave(d) { return CME.dataValida(d.data_indexacao) ? d.data_indexacao : (CME.dataValida(d.data) ? d.data : ''); }
      var docs = CME.lista(res).filter(function (d) { return d && d.id != null && chave(d); })
        .sort(function (a, b) {
          var ka = chave(a), kb = chave(b);
          if (ka !== kb) return ka < kb ? 1 : -1;
          var da = CME.dataValida(a.data) ? a.data : '', db = CME.dataValida(b.data) ? b.data : '';
          return da < db ? 1 : da > db ? -1 : 0;
        }).slice(0, 5);
      if (!docs.length) { CME.vazio(el, 'Nenhum documento publicado ainda.'); return; }
      el.innerHTML = '<ul class="doc-list">' + docs.map(function (d) {
        var cat = CME.CATEGORIAS[d.categoria] || CME.CATEGORIAS.outros;
        var st = CME.temEstado(d) ? '' : CME.STATUS_DOC[d.status];
        var externo = CME.ehExterno(d);
        var href = externo ? null : CME.hrefArquivo(d.arquivo);
        var datas = (CME.dataValida(d.data) ? 'Documento de ' + CME.formatarData(d.data) : 'Documento sem data') +
          (CME.dataValida(d.data_indexacao) ? ' · incluído em ' + CME.formatarData(d.data_indexacao) : '');
        return '<li><article class="doc-card"><div class="doc-top">' +
          (st ? '<span class="badge ' + esc(d.status) + '">' + esc(st) + '</span>' : '') +
          '<span class="badge tipo">' + esc(cat.rotulo) + '</span><span class="tiny">' + esc(datas) + '</span></div>' +
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
  /* Agrupa pessoas de um segmento em pares titular → suplente (campo "par"; sem ele, pela ordem do ato). */
  function paresDoSegmento(pessoas) {
    var pares = [], porPar = {};
    pessoas.forEach(function (p) {
      var cond = String(p.condicao || '').toLowerCase();
      var n = typeof p.par === 'number' && isFinite(p.par) ? String(p.par) : (/^\d+$/.test(String(p.par || '')) ? String(p.par) : '');
      var alvo;
      if (n) {
        alvo = porPar[n];
        if (!alvo) { alvo = porPar[n] = { n: +n, titular: null, suplente: null, extras: [] }; pares.push(alvo); }
      } else if (cond === 'suplente') {
        alvo = pares.filter(function (x) { return x.titular && !x.suplente && !x.fixo; }).pop();
        if (!alvo) { alvo = { titular: null, suplente: null, extras: [] }; pares.push(alvo); }
      } else {
        alvo = { titular: null, suplente: null, extras: [] }; pares.push(alvo);
      }
      if (n) alvo.fixo = true;
      if (cond === 'suplente' && !alvo.suplente) alvo.suplente = p;
      else if (cond !== 'suplente' && !alvo.titular) alvo.titular = p;
      else alvo.extras.push(p);
    });
    if (pares.every(function (x) { return x.n != null; })) pares.sort(function (a, b) { return a.n - b.n; });
    return pares;
  }
  function pessoaHTML(p, atoGeral) {
    if (!p) return '<span class="muted">—<span class="sr-only"> não consta na lista</span></span>';
    var h = esc(p.nome);
    if (p.cargo_mesa) h += ' <span class="badge tipo">' + esc(p.cargo_mesa) + '</span>';
    if (p.entidade) h += '<span class="tiny" style="display:block">' + esc(p.entidade) + '</span>';
    if (p.grafia_no_ato && p.grafia_no_ato !== p.nome) {
      h += '<span class="tiny" style="display:block">Grafia no ato: “' + esc(p.grafia_no_ato) + '”</span>';
    }
    var u = CME.urlExterna(p.ato_url);
    if (u && u !== atoGeral) h += '<a class="tiny" style="display:block" href="' + esc(u) + '" target="_blank" rel="noopener">Ato de nomeação <span aria-hidden="true">↗</span><span class="sr-only">(abre em nova aba)</span></a>';
    return h;
  }
  function conselheiros() {
    var el = $('lista-conselheiros');
    Promise.all([CME.carregar('data/conselheiros.json'), conteudo()]).then(function (r) {
      var lista = CME.lista(r[0]).filter(function (p) { return p && p.nome; });
      var c = r[1];
      var res = c.composicao_resumo && typeof c.composicao_resumo === 'object' ? c.composicao_resumo : null;
      var nota = c.conselheiros_nota && c.conselheiros_nota.texto ? c.conselheiros_nota : null;
      if (!lista.length) { CME.vazio(el, 'Composição será publicada após conferência do ato oficial.'); return; }
      var tit = lista.filter(function (p) { return String(p.condicao).toLowerCase() === 'titular'; }).length;
      var sup = lista.filter(function (p) { return String(p.condicao).toLowerCase() === 'suplente'; }).length;
      var atoGeral = res ? CME.urlExterna(res.ato_url) : null;
      var html = '<section class="panel" aria-labelledby="resumo-t"><h2 id="resumo-t">Resumo da composição</h2>';
      function n(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
      if (res && n(res.titulares_nomeados) != null && n(res.cadeiras_legais_titulares) != null) {
        html += '<p class="resumo-num"><strong>' + n(res.titulares_nomeados) + ' de ' + n(res.cadeiras_legais_titulares) + '</strong> titulares nomeados' +
          (n(res.suplentes_nomeados) != null && n(res.cadeiras_legais_suplentes) != null
            ? ' e <strong>' + n(res.suplentes_nomeados) + ' de ' + n(res.cadeiras_legais_suplentes) + '</strong> suplentes nomeados' : '') +
          ' em relação às cadeiras previstas em lei.</p>';
      } else {
        html += '<p>Esta página lista ' + tit + ' titulares e ' + sup + ' suplentes, conforme o ato de nomeação indicado na fonte. ' +
          'O número de cadeiras previsto em lei está na página <a href="../sobre/index.html#composicao">Sobre</a>.</p>';
      }
      var linhas = [];
      if (res && res.mandato_texto) linhas.push(['Mandato', esc(CME.texto(res.mandato_texto))]);
      if (res && (res.ato_titulo || atoGeral)) {
        linhas.push(['Ato de nomeação', atoGeral
          ? '<a href="' + esc(atoGeral) + '" target="_blank" rel="noopener">' + esc(res.ato_titulo || 'Ver ato oficial') + ' <span aria-hidden="true">↗</span><span class="sr-only">(abre em nova aba)</span></a>'
          : esc(res.ato_titulo)]);
      }
      if (linhas.length) html += '<dl class="doc-meta">' + linhas.map(function (l) { return '<div><dt>' + l[0] + ':</dt><dd>' + l[1] + '</dd></div>'; }).join('') + '</dl>';
      if (res && res.fonte) html += CME.fonteHTML(res.fonte);
      html += '</section>';
      if (nota) {
        html += '<div class="notice" role="note"><strong>Situação da composição</strong>' + paragrafos(nota.texto) +
          (nota.fonte ? '<p class="fonte">' + esc(nota.fonte) + '</p>' : '') + '</div>';
      }
      function ordemCargo(c) {
        var n = CME.normalizar(c);
        return /^presidente/.test(n) ? 0 : /^vice/.test(n) ? 1 : /secretari/.test(n) ? 2 : 3;
      }
      var mesa = lista.filter(function (p) { return p.cargo_mesa; })
        .sort(function (a, b) { return ordemCargo(a.cargo_mesa) - ordemCargo(b.cargo_mesa); });
      if (mesa.length) {
        html += '<section class="panel" aria-labelledby="mesa-t"><h2 id="mesa-t">Mesa diretora</h2><ul>' +
          mesa.map(function (p) { return '<li><strong>' + esc(p.cargo_mesa) + ':</strong> ' + esc(p.nome) + (p.segmento ? ' <span class="tiny">(' + esc(p.segmento) + ')</span>' : '') + '</li>'; }).join('') + '</ul></section>';
      }
      var grupos = {}, ordem = [];
      lista.forEach(function (p) {
        var g = p.segmento || 'Segmento não informado';
        if (!grupos[g]) { grupos[g] = []; ordem.push(g); }
        grupos[g].push(p);
      });
      html += '<div class="table-wrap pares" style="margin-top:16px"><table><caption>Conselheiros por segmento: cada titular e o respectivo suplente</caption>' +
        '<thead><tr><th scope="col">Titular</th><th scope="col">Suplente</th></tr></thead>';
      ordem.forEach(function (g) {
        html += '<tbody><tr><th scope="rowgroup" colspan="2" class="segmento">' + esc(g) + '</th></tr>';
        paresDoSegmento(grupos[g]).forEach(function (x) {
          html += '<tr><td>' + pessoaHTML(x.titular, atoGeral) + '</td><td>' + pessoaHTML(x.suplente, atoGeral) + '</td></tr>';
          x.extras.forEach(function (p) {
            html += '<tr><td colspan="2">' + pessoaHTML(p, atoGeral) + ' <span class="tiny">(' + esc(p.condicao || 'condição não informada') + ')</span></td></tr>';
          });
        });
        html += '</tbody>';
      });
      html += '</table></div>';
      var fontes = [];
      lista.forEach(function (p) { var f = CME.fontePublica(p.fonte); if (f && fontes.indexOf(f) === -1) fontes.push(f); });
      if (fontes.length) html += '<p class="fonte">' + esc(fontes.join('; ')) + '</p>';
      var mand = [];
      lista.forEach(function (p) { if (p.mandato && mand.indexOf(p.mandato) === -1) mand.push(p.mandato); });
      if (mand.length && !(res && res.mandato_texto)) html += '<p class="tiny">Mandato indicado no registro: ' + esc(mand.join('; ')) + '.</p>';
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
    consolidacaoAnual($('consolidacao-anual'));
    datasAtualizacao($('datas-atualizacao'));
  }

  /* Consolidação anual (art. 21 da Lei 1.166/2024): lista gerada do índice, por ano e categoria. Não cria documento. */
  var CATS_ATOS = ['regimento', 'resolucoes', 'pareceres', 'oficios', 'convocacoes', 'pautas', 'atas', 'boletins'];
  function consolidacaoAnual(el) {
    if (!el) return;
    CME.carregar('data/documentos.json').then(function (res) {
      var docs = CME.lista(res).filter(function (d) { return d && d.id != null && CATS_ATOS.indexOf(d.categoria) !== -1; });
      var porAno = {}, semAno = [];
      docs.forEach(function (d) {
        var a = CME.anoDoc ? CME.anoDoc(d) : (CME.dataValida(d.data) ? d.data.slice(0, 4) : '');
        if (!a) { semAno.push(d); return; }
        (porAno[a] = porAno[a] || []).push(d);
      });
      var anos = Object.keys(porAno).sort().reverse();
      if (!anos.length) { CME.vazio(el, 'Nenhum ato do Conselho publicado neste portal até o momento.'); return; }
      function itemDoc(d) {
        return '<li><a href="' + esc(CME.linkPagina(d)) + '">' + esc(d.titulo || 'Documento sem título') + '</a>' +
          (CME.dataValida(d.data) ? ' <span class="tiny">— ' + esc(CME.formatarData(d.data)) + '</span>' : '') + '</li>';
      }
      el.innerHTML = anos.map(function (a, i) {
        var l = porAno[a];
        var corpo = CATS_ATOS.filter(function (c) { return l.some(function (d) { return d.categoria === c; }); }).map(function (c) {
          var itens = l.filter(function (d) { return d.categoria === c; })
            .sort(function (x, y) { return String(x.data || '') < String(y.data || '') ? -1 : String(x.data || '') > String(y.data || '') ? 1 : 0; });
          return '<h4>' + esc(CME.CATEGORIAS[c].rotulo) + ' (' + itens.length + ')</h4><ul>' + itens.map(itemDoc).join('') + '</ul>';
        }).join('');
        return '<details class="ano-consolidado"' + (i === 0 ? ' open' : '') + '><summary>' + esc(a) + ' — ' + l.length +
          (l.length === 1 ? ' documento' : ' documentos') + '</summary>' + corpo + '</details>';
      }).join('') + (semAno.length ? '<p class="tiny">Documentos sem data ou ano informado: ' + semAno.length + '.</p>' : '');
    });
  }
  function datasAtualizacao(el) {
    if (!el) return;
    CME.atualizacao().then(function (a) {
      var itens = [['acervo', 'Acervo de documentos'], ['calendario', 'Reuniões e calendário'], ['composicao', 'Composição do Conselho'], ['conteudo', 'Textos institucionais']]
        .filter(function (x) { return a[x[0]] && CME.dataValida(a[x[0]].data); });
      if (!itens.length) { el.hidden = true; return; }
      el.innerHTML = '<p class="tiny">Data da última mudança registrada em cada conjunto de dados (não é a data dos documentos):</p><ul>' +
        itens.map(function (x) { return '<li>' + esc(x[1]) + ': <time datetime="' + esc(a[x[0]].data) + '">' + esc(CME.formatarData(a[x[0]].data)) + '</time></li>'; }).join('') + '</ul>';
      el.hidden = false;
    });
  }

  /* ---------------- Repositório (config) ---------------- */
  CME.repositorio = function (cfg) {
    var r = typeof cfg.repositorio === 'string' ? cfg.repositorio.trim() : '';
    r = r.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
    return /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(r) ? 'https://github.com/' + r : '';
  };

  /* ---------------- Contato ---------------- */
  CME.emailPublico = function (cfg) {
    return typeof cfg.email_publico === 'string' && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(cfg.email_publico.trim()) ? cfg.email_publico.trim() : '';
  };
  /* O formulário NÃO envia nada: só monta um e-mail no programa do visitante ou copia o texto. */
  function contato() {
    Promise.all([CME.config(), conteudo()]).then(function (r) {
      var cfg = r[0], c = r[1];
      var email = CME.emailPublico(cfg);
      var dados = $('contato-dados');
      var linhas = [
        ['E-mail institucional', email ? '<a href="mailto:' + esc(email) + '">' + esc(email) + '</a> ' +
          '<button type="button" class="btn small ghost" id="copiar-email">' + CME.icone('copy') + '<span data-rotulo>Copiar e-mail</span></button>' : ''],
        ['Endereço', cfg.endereco ? esc(cfg.endereco) : ''],
        ['Telefone', cfg.telefone_publico ? esc(cfg.telefone_publico) : '']
      ];
      dados.innerHTML = '<dl class="contato-lista">' + linhas.map(function (l) {
        return '<div><dt>' + l[0] + '</dt><dd>' + (l[1] || '<span class="muted">ainda não informado neste site</span>') + '</dd></div>';
      }).join('') + '</dl>';
      var bCopiarEmail = $('copiar-email');
      if (bCopiarEmail) bCopiarEmail.addEventListener('click', function () { CME.copiar(email, bCopiarEmail, 'E-mail do CME copiado.'); });

      /* Pedido formal pela LAI: textos e links vêm de conteudo.json */
      var lai = $('contato-lai-conteudo');
      if (lai) {
        var t = c.transparencia && typeof c.transparencia === 'object' ? c.transparencia.como_pedir : null;
        var links = CME.linksConteudo(c).filter(function (l) {
          return /acesso a informacao|ouvidoria|12\.527/.test(CME.normalizar(l.titulo + ' ' + (l.descricao || '')));
        });
        var h = t ? blocoTexto(t) : '';
        if (links.length) h += '<ul>' + links.map(function (l) {
          return '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.titulo) + ' <span aria-hidden="true">↗</span><span class="sr-only">(abre em nova aba)</span></a></li>';
        }).join('') + '</ul>';
        lai.innerHTML = h || '<p class="muted">Os canais oficiais de acesso à informação serão indicados aqui após conferência.</p>';
      }

      var form = $('form-contato');
      var saida = $('contato-saida');
      var campo = $('c-mensagem');
      var erro = $('c-erro');
      if (!email) $('contato-sem-email').hidden = false;
      function montar() {
        var nome = $('c-nome').value.trim();
        var assunto = $('c-assunto').value;
        var msg = campo.value.trim();
        var corpo = msg + (nome ? '\n\n— ' + nome : '') + '\n\n(Mensagem preparada no site do CME Montanha.)';
        return { titulo: '[Site CME] ' + assunto, corpo: corpo, msg: msg };
      }
      function validar() {
        if (campo.value.trim()) { limparErro(); return true; }
        erro.textContent = 'Escreva a mensagem antes de continuar.';
        campo.setAttribute('aria-invalid', 'true');
        campo.focus();
        return false;
      }
      function limparErro() { erro.textContent = ''; campo.removeAttribute('aria-invalid'); }
      campo.addEventListener('input', function () { if (campo.value.trim()) limparErro(); });
      function textoCompleto(m) { return (email ? 'Para: ' + email + '\n' : '') + 'Assunto: ' + m.titulo + '\n\n' + m.corpo; }
      function mostrar(html, m) {
        saida.innerHTML = '<div class="notice">' + html + '</div>' +
          '<p class="tiny">Texto da mensagem:</p><pre class="hash" style="white-space:pre-wrap">' + esc(textoCompleto(m)) + '</pre>';
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validar()) return;
        var m = montar();
        if (!email) {
          mostrar('<p>O e-mail institucional do CME ainda não foi informado neste site. Use “Copiar mensagem” e envie pelos canais oficiais.</p>', m);
          return;
        }
        var href = 'mailto:' + email + '?subject=' + encodeURIComponent(m.titulo) + '&body=' + encodeURIComponent(m.corpo);
        if (href.length > 1900) {
          mostrar('<p>A mensagem é longa demais para abrir direto no programa de e-mail. Use “Copiar mensagem” e cole-a em um e-mail para <strong>' + esc(email) + '</strong>.</p>', m);
          return;
        }
        mostrar('<p><strong>O seu programa de e-mail deve abrir com a mensagem pronta.</strong> O CME só recebe a mensagem depois que você clicar em “Enviar” no seu programa de e-mail.</p>' +
          '<p>Se nada abriu, o seu dispositivo pode não ter um programa de e-mail configurado: use “Copiar mensagem” e cole o texto em um e-mail para <strong>' + esc(email) + '</strong>.</p>', m);
        window.location.href = href;
      });
      $('contato-copiar').addEventListener('click', function () {
        if (!validar()) return;
        var m = montar();
        CME.copiar(textoCompleto(m), $('contato-copiar'), 'Mensagem copiada.');
        mostrar('<p>Mensagem copiada. Cole-a em um e-mail' + (email ? ' para <strong>' + esc(email) + '</strong>' : '') +
          ' no serviço de e-mail que você usa. O CME só recebe a mensagem depois que você a enviar.</p>', m);
      });
      var disc = $('contato-discussoes');
      if (CME.repositorio(cfg) && disc) disc.hidden = false;
    });
  }

  /* ---------------- Privacidade: e-mail institucional para pedidos ---------------- */
  function privacidade() {
    CME.config().then(function (cfg) {
      var email = CME.emailPublico(cfg);
      Array.prototype.forEach.call(document.querySelectorAll('[data-email-publico]'), function (el) {
        el.innerHTML = email ? 'pelo e-mail institucional <a href="mailto:' + esc(email) + '">' + esc(email) + '</a>'
          : 'pela página <a href="../contato/index.html">Fale com o CME</a>';
      });
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
    contato: contato, mural: mural, faq: faq, glossario: glossario, links: links, privacidade: privacidade };
  CME.pronto(function () { if (mapa[CME.pagina]) mapa[CME.pagina](); });
})();
