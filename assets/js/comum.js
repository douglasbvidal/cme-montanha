/* CME Montanha — utilidades comuns (script clássico, funciona também em file://).
   Todos os dados institucionais vêm de data/*.json e site.config.json.
   Nenhum rastreador, nenhuma requisição a terceiros. */
(function () {
  'use strict';

  var CME = window.CME = window.CME || {};
  var body = document.body;
  var raiz = (body && body.getAttribute('data-raiz')) || './';
  CME.raiz = raiz;
  CME.pagina = (body && body.getAttribute('data-pagina')) || '';
  CME.arquivoLocal = window.location.protocol === 'file:';

  /* ---------------- Rótulos (descrevem o esquema, não fatos) ---------------- */
  CME.CATEGORIAS = {
    legislacao: { rotulo: 'Legislação', pagina: 'legislacao/index.html' },
    regimento: { rotulo: 'Regimento', pagina: 'regimento/index.html' },
    resolucoes: { rotulo: 'Resolução', pagina: 'resolucoes-pareceres/index.html' },
    pareceres: { rotulo: 'Parecer', pagina: 'resolucoes-pareceres/index.html' },
    oficios: { rotulo: 'Ofício', pagina: 'oficios/index.html' },
    pautas: { rotulo: 'Pauta', pagina: 'reunioes/index.html', aba: 'pautas' },
    convocacoes: { rotulo: 'Convocação', pagina: 'reunioes/index.html', aba: 'pautas' },
    atas: { rotulo: 'Ata', pagina: 'reunioes/index.html', aba: 'atas' },
    boletins: { rotulo: 'Boletim ou relatório', pagina: 'transparencia/index.html' },
    outros: { rotulo: 'Outros documentos', pagina: 'transparencia/index.html' }
  };
  CME.STATUS_DOC = {
    vigente: 'Vigente', assinado: 'Assinado', enviado: 'Enviado',
    em_estudo: 'Em estudo', referencia: 'Referência'
  };
  CME.STATUS_REUNIAO = {
    realizada: 'Realizada', prevista: 'Prevista', convocada: 'Convocada', cancelada: 'Cancelada',
    sem_quorum: 'Sem quórum (informativa)', sem_registro: 'Prevista; sem registro de realização'
  };
  CME.MODALIDADES = { presencial: 'Presencial', remota: 'Remota (videoconferência)', hibrida: 'Híbrida (presencial e videoconferência)' };
  /* Estados documentais (campos opcionais de documentos.json). tom: classe visual do selo; o texto sempre diz o estado. */
  CME.ESTADOS = [
    { campo: 'estado_documental', rotulo: 'Documento', valores: {
      original_assinado: ['Original assinado', 'ok'], original_sem_assinatura: ['Cópia sem assinatura', 'warn'],
      copia_com_tarja: ['Cópia com tarja de dados pessoais', 'info'], reproducao_digital: ['Reprodução digital', 'neutral'],
      referencia_externa: ['Referência externa (link oficial)', 'neutral'] } },
    { campo: 'estado_deliberativo', rotulo: 'Deliberação', valores: {
      aprovado_plenario: ['Aprovado pelo Plenário', 'ok'], emitido_ad_referendum: ['Emitido ad referendum do Plenário', 'warn'],
      ratificacao_registrada_em_ata_nao_aprovada: ['Ratificação registrada em ata ainda não aprovada', 'warn'],
      referendo_em_minuta_de_ata: ['Referendo registrado em minuta de ata', 'warn'],
      nao_aplicavel: ['Não se aplica', 'neutral'], pendente_verificacao: ['Pendente de verificação', 'warn'] } },
    { campo: 'estado_homologacao', rotulo: 'Homologação', valores: {
      homologado: ['Homologado', 'ok'], nao_exigida: ['Não exigida', 'neutral'], pendente: ['Pendente', 'warn'],
      nao_localizada: ['Não localizada', 'warn'] } },
    { campo: 'estado_publicacao', rotulo: 'Publicação', valores: {
      publicado_dom: ['Publicado no DOM/ES', 'ok'], publicado_portal_transparencia: ['Publicado no Portal da Transparência', 'ok'],
      publicado_neste_portal: ['Divulgado somente neste portal', 'info'], nao_publicado_oficialmente: ['Não publicado oficialmente', 'warn'] } },
    { campo: 'estado_vigencia', rotulo: 'Vigência', valores: {
      vigente: ['Vigente', 'ok'], prazo_encerrado: ['Prazo encerrado', 'neutral'], revogado: ['Revogado', 'danger'],
      a_confirmar: ['A confirmar', 'warn'], nao_aplicavel: ['Não se aplica', 'neutral'] } }
  ];
  /* Lista de {campo, rotulo, valor, texto, tom} dos estados válidos do documento (omite "não se aplica"). */
  CME.estadosDoc = function (d) {
    var out = [];
    if (!d) return out;
    CME.ESTADOS.forEach(function (e) {
      var v = d[e.campo];
      if (typeof v !== 'string' || !e.valores[v] || v === 'nao_aplicavel') return;
      out.push({ campo: e.campo, rotulo: e.rotulo, valor: v, texto: e.valores[v][0], tom: e.valores[v][1] });
    });
    return out;
  };
  CME.temEstado = function (d) {
    return CME.ESTADOS.some(function (e) { return d && typeof d[e.campo] === 'string' && e.valores[d[e.campo]]; });
  };
  CME.MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  CME.DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  /* ---------------- Utilidades ---------------- */
  CME.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  CME.texto = function (v) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'object' && v.texto != null) return String(v.texto);
    return '';
  };
  CME.normalizar = function (s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  };
  CME.slug = function (s) {
    return CME.normalizar(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
  };
  CME.dataValida = function (iso) { return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso); };
  CME.formatarData = function (iso) {
    if (!CME.dataValida(iso)) return '—';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  };
  CME.dataObj = function (iso) {
    if (!CME.dataValida(iso)) return null;
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  };
  CME.dataExtenso = function (iso) {
    var d = CME.dataObj(iso);
    if (!d) return '—';
    return d.getDate() + ' de ' + CME.MESES[d.getMonth()] + ' de ' + d.getFullYear();
  };
  CME.diaSemana = function (iso) {
    var d = CME.dataObj(iso);
    return d ? CME.DIAS[d.getDay()] : '';
  };
  CME.hojeISO = function () {
    var d = new Date();
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  };
  CME.tamanho = function (kb) {
    var n = Number(kb);
    if (!isFinite(n) || n <= 0) return '';
    if (n >= 1024) return (n / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB';
    return Math.max(1, Math.round(n)).toLocaleString('pt-BR') + ' KB';
  };
  CME.paginas = function (p) {
    var n = parseInt(p, 10);
    if (!isFinite(n) || n <= 0) return '';
    return n + (n === 1 ? ' página' : ' páginas');
  };
  /* Só aceita caminhos relativos dentro de docs/ (sem "..", sem protocolo). */
  CME.hrefArquivo = function (arquivo) {
    if (typeof arquivo !== 'string') return null;
    var a = arquivo.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!/^docs\//.test(a) || a.indexOf('..') !== -1 || /^[a-z]+:/i.test(a)) return null;
    return raiz + a.split('/').map(encodeURIComponent).join('/');
  };
  CME.urlExterna = function (u) {
    return typeof u === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : null;
  };
  /* Exibe fonte apenas se não parecer caminho absoluto de computador pessoal. */
  CME.fontePublica = function (f) {
    var t = CME.texto(f).trim();
    if (!t) return '';
    if (/(^|[\s(])[a-z]:[\\/]/i.test(t) || /[\\/](users|home)[\\/]/i.test(t) || /onedrive/i.test(t)) return '';
    return t;
  };
  /* Documento de outro órgão: só link oficial (sem PDF hospedado). */
  CME.ehExterno = function (d) { return !!(d && d.externo === true && CME.urlExterna(d.url)); };
  CME.ROTULO_EXTERNO = 'Documento de outro órgão — link oficial';
  CME.rotuloTipoReuniao = function (t) {
    var mapa = { ordinaria: 'Ordinária', 'ordinária': 'Ordinária', extraordinaria: 'Extraordinária', 'extraordinária': 'Extraordinária' };
    var k = String(t || '').toLowerCase().trim();
    if (mapa[k]) return mapa[k];
    return k ? k.charAt(0).toUpperCase() + k.slice(1) : '';
  };
  CME.rotuloReuniao = function (r) {
    var t = CME.rotuloTipoReuniao(r && r.tipo);
    if (!t) return 'Reunião';
    return /reuni/i.test(t) ? t : (/^(posse|sess)/i.test(t) ? t : 'Reunião ' + t.toLowerCase());
  };
  /* Identificadores estáveis de reunião: r.id (quando válido) ou data + tipo normalizado;
     repetições recebem sufixo -2, -3… (mesmo algoritmo de tools/gerar_ics.py). Recebe a lista completa. */
  CME.idsReunioes = function (lista) {
    var usados = {};
    return (lista || []).map(function (r) {
      r = r || {};
      var base = typeof r.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(r.id) ? r.id
        : (typeof r.id === 'string' && r.id.trim() ? CME.slug(r.id)
          : (CME.dataValida(r.data) ? r.data : 'sem-data') + '-' + CME.slug(r.tipo || 'reuniao'));
      var id = base, n = 2;
      while (usados[id]) id = base + '-' + (n++);
      usados[id] = true;
      return id;
    });
  };
  /* Horário: aceita "16h30", "9h", "09:00", "16:30". Devolve {h, m, texto} ou null. */
  CME.horario = function (v) {
    var m = /^\s*(\d{1,2})\s*(?:[h:]\s*(\d{2})?)\s*(?:h|min)?\s*$/i.exec(String(v == null ? '' : v));
    if (!m) return null;
    var h = parseInt(m[1], 10), mi = m[2] ? parseInt(m[2], 10) : 0;
    if (h > 23 || mi > 59) return null;
    return { h: h, m: mi, texto: h + 'h' + (mi ? (mi < 10 ? '0' : '') + mi : '') };
  };
  CME.linkReuniao = function (id) {
    return raiz + 'reunioes/index.html?aba=calendario#reuniao-' + encodeURIComponent(String(id));
  };
  /* Variações de números de atos: "004/2026" → "004/2026 004-2026 4/2026 4-2026 004 2026". */
  CME.variantesNumero = function (texto) {
    var out = [];
    String(texto == null ? '' : texto).replace(/(\d{1,4})\s*[\/\-.]\s*((?:19|20)\d{2})/g, function (m, n, a) {
      var s = String(parseInt(n, 10));
      [n + '/' + a, n + '-' + a, s + '/' + a, s + '-' + a, n + ' ' + a, s + ' ' + a].forEach(function (v) {
        if (out.indexOf(v) === -1) out.push(v);
      });
      return m;
    });
    return out.join(' ');
  };
  CME.linkPagina = function (doc) {
    var c = CME.CATEGORIAS[doc && doc.categoria] || CME.CATEGORIAS.outros;
    var q = c.aba ? '?aba=' + c.aba : '';
    return raiz + c.pagina + q + '#doc-' + encodeURIComponent(String(doc.id));
  };
  CME.parametro = function (nome) {
    var m = new RegExp('[?&]' + nome + '=([^&#]*)').exec(window.location.search);
    if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return ''; }
  };
  CME.icone = function (nome) {
    var p = {
      doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
      download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
      external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
      shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
      chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
      users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
      scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
      book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
      link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
      copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
    };
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (p[nome] || p.doc) + '</svg>';
  };

  /* Destaque de termos, insensível a acentos e caixa; escapa o restante. */
  var CLASSES = { a: 'aáàâãä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôõö', u: 'uúùûü', c: 'cç', n: 'nñ' };
  CME.termos = function (consulta) {
    return CME.normalizar(consulta).split(/\s+/).filter(function (t) { return t.length > 0; }).slice(0, 8);
  };
  function regexTermos(termos) {
    var partes = termos.map(function (t) {
      return t.split('').map(function (ch) {
        if (CLASSES[ch]) return '[' + CLASSES[ch] + CLASSES[ch].toUpperCase() + ']';
        return ch.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&');
      }).join('');
    });
    partes.sort(function (a, b) { return b.length - a.length; });
    return partes.length ? new RegExp('(' + partes.join('|') + ')', 'gi') : null;
  }
  CME.realcar = function (texto, termos) {
    var s = String(texto == null ? '' : texto);
    var re = termos && termos.length ? regexTermos(termos) : null;
    if (!re) return CME.esc(s);
    var out = '', ult = 0, m;
    while ((m = re.exec(s)) !== null) {
      if (m[0] === '') { re.lastIndex++; continue; }
      out += CME.esc(s.slice(ult, m.index)) + '<mark>' + CME.esc(m[0]) + '</mark>';
      ult = m.index + m[0].length;
    }
    return out + CME.esc(s.slice(ult));
  };

  /* ---------------- Carregamento de dados ---------------- */
  var cache = {};
  /* Resolve sempre (nunca rejeita): {ok, dados, motivo}. motivo: 'arquivo-local' | 'ausente' | 'invalido' | 'rede' */
  CME.carregar = function (caminho) {
    if (cache[caminho]) return cache[caminho];
    var p;
    if (CME.arquivoLocal) {
      /* Em file:// o navegador bloqueia a leitura; não tenta (evita erros no console). */
      p = Promise.resolve({ ok: false, dados: null, motivo: 'arquivo-local' });
      p.then(function () { CME.avisoArquivoLocal(); });
    } else if (typeof window.fetch !== 'function') {
      p = Promise.resolve({ ok: false, dados: null, motivo: 'rede' });
    } else {
      p = window.fetch(raiz + caminho, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) return { ok: false, dados: null, motivo: 'ausente' };
        return r.json().then(function (j) { return { ok: true, dados: j, motivo: '' }; },
          function () { return { ok: false, dados: null, motivo: 'invalido' }; });
      }, function () {
        return { ok: false, dados: null, motivo: CME.arquivoLocal ? 'arquivo-local' : 'rede' };
      }).then(function (res) {
        if (res.motivo === 'arquivo-local') CME.avisoArquivoLocal();
        if (res.motivo === 'invalido' && window.console) console.warn('Arquivo de dados inválido: ' + caminho);
        return res;
      });
    }
    cache[caminho] = p;
    return p;
  };
  CME.lista = function (res) { return res && res.ok && Array.isArray(res.dados) ? res.dados : []; };
  CME.objeto = function (res) {
    return res && res.ok && res.dados && typeof res.dados === 'object' && !Array.isArray(res.dados) ? res.dados : {};
  };
  CME.config = function () {
    return CME.carregar('site.config.json').then(CME.objeto);
  };

  var avisoMostrado = false;
  CME.avisoArquivoLocal = function () {
    if (avisoMostrado) return;
    avisoMostrado = true;
    var main = document.getElementById('conteudo');
    if (!main) return;
    var div = document.createElement('div');
    div.className = 'wrap global-notice';
    div.innerHTML = '<div class="notice warn" role="status"><strong>Dados indisponíveis neste modo de abertura.</strong>' +
      '<p>O navegador bloqueia a leitura dos dados quando a página é aberta diretamente do disco (file://). ' +
      'Abra via servidor local (por exemplo, <code>python -m http.server</code> na pasta do site) ou pelo site publicado.</p></div>';
    main.insertBefore(div, main.firstChild);
  };

  CME.vazio = function (el, msg) {
    if (!el) return;
    el.innerHTML = '<div class="empty-state"><p>' + CME.esc(msg || 'Nenhum documento publicado nesta seção ainda.') + '</p></div>';
  };
  CME.fonteHTML = function (f, artigo) {
    var t = CME.fontePublica(f);
    var a = CME.texto(artigo).trim();
    if (!t) return '';
    return '<p class="fonte">' + CME.esc(t) + (a && t.indexOf(a) === -1 ? ', ' + CME.esc(a) : '') + '</p>';
  };
  CME.ROTULOS_SOBRE = {
    finalidade: 'Finalidade', natureza: 'Natureza', composicao: 'Composição', mandato: 'Mandato',
    competencias: 'Competências', funcionamento: 'Funcionamento', regimento: 'Regimento interno'
  };
  /* Links do conteudo.json: aceita "links" (lista) ou "links_uteis.verificados" (lista).
     Links "candidatos não verificados" nunca são exibidos. */
  CME.linksConteudo = function (c) {
    var l = [];
    if (Array.isArray(c.links)) l = l.concat(c.links);
    if (c.links_uteis && Array.isArray(c.links_uteis.verificados)) l = l.concat(c.links_uteis.verificados);
    return l.filter(function (x) { return x && x.titulo && CME.urlExterna(x.url); });
  };
  /* Normaliza um campo de conteúdo: string | {texto,fonte,artigo} | lista desses -> lista de {texto,fonte,artigo}. */
  CME.itensTexto = function (v) {
    var lista = Array.isArray(v) ? v : [v];
    return lista.map(function (x) {
      if (x == null) return null;
      if (typeof x === 'string' || typeof x === 'number') return { texto: String(x) };
      if (typeof x === 'object' && x.texto != null) return { texto: String(x.texto), fonte: x.fonte, artigo: x.artigo };
      return null;
    }).filter(function (x) { return x && x.texto.trim(); });
  };

  /* ---------------- Interface comum ---------------- */
  function temaAtual() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function iniciarTema() {
    var b = document.querySelector('[data-theme-toggle]');
    if (!b) return;
    function atualizar() {
      var escuro = temaAtual() === 'dark';
      b.setAttribute('aria-pressed', escuro ? 'true' : 'false');
      b.setAttribute('aria-label', escuro ? 'Usar tema claro' : 'Usar tema escuro');
      b.title = b.getAttribute('aria-label');
    }
    b.addEventListener('click', function () {
      var novo = temaAtual() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', novo);
      try { window.localStorage.setItem('cme-tema', novo); } catch (e) { /* sem armazenamento */ }
      atualizar();
    });
    atualizar();
  }
  function iniciarMenu() {
    var b = document.getElementById('menu-button');
    var nav = document.getElementById('nav-menu');
    if (!b || !nav) return;
    b.addEventListener('click', function () {
      var aberto = nav.classList.toggle('is-open');
      b.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        b.setAttribute('aria-expanded', 'false');
        b.focus();
      }
    });
  }
  function iniciarVoltarTopo() {
    var b = document.getElementById('back-top');
    if (!b) return;
    function ver() { b.hidden = window.scrollY < 600; }
    window.addEventListener('scroll', ver, { passive: true });
    b.addEventListener('click', function () {
      window.scrollTo(0, 0);
      var alvo = document.getElementById('conteudo');
      if (alvo) { alvo.setAttribute('tabindex', '-1'); alvo.focus({ preventScroll: true }); }
    });
    ver();
  }
  /* data/atualizacao.json (gerado por tools/registrar_atualizacao.py): datas de mudança real de cada conjunto. */
  CME.atualizacao = function () {
    return CME.carregar('data/atualizacao.json').then(CME.objeto);
  };
  function iniciarRodape() {
    var linha = document.querySelector('[data-atualizacao-linha]');
    var alvo = document.querySelector('[data-atualizacao]');
    if (!linha || !alvo) return;
    CME.atualizacao().then(function (a) {
      var d = a.acervo && CME.dataValida(a.acervo.data) ? a.acervo.data : '';
      if (!d) return; /* sem o arquivo, nenhuma data é exibida */
      alvo.textContent = CME.formatarData(d);
      alvo.setAttribute('datetime', d);
      linha.hidden = false;
    });
  }
  /* Região viva para anúncios curtos (copiado, erro etc.). */
  CME.anunciar = function (msg) {
    var r = document.getElementById('cme-anuncio');
    if (!r) {
      r = document.createElement('p');
      r.id = 'cme-anuncio';
      r.className = 'sr-only';
      r.setAttribute('role', 'status');
      r.setAttribute('aria-live', 'polite');
      document.body.appendChild(r);
    }
    r.textContent = '';
    setTimeout(function () { r.textContent = msg; }, 30);
  };
  /* Rola até o alvo (#doc-..., #reuniao-...) depois que a lista é renderizada. */
  CME.focarAlvo = function () {
    var h = window.location.hash;
    if (!h || h.length < 2) return;
    var el;
    try { el = document.getElementById(decodeURIComponent(h.slice(1))); } catch (e) { el = null; }
    if (!el) return;
    Array.prototype.forEach.call(document.querySelectorAll('.is-target'), function (x) { if (x !== el) x.classList.remove('is-target'); });
    el.classList.add('is-target');
    /* alvo dentro de uma aba oculta: ativa a aba correspondente */
    var painel = el.closest && el.closest('[role="tabpanel"]');
    if (painel && painel.hidden) {
      var aba = document.querySelector('[role="tab"][aria-controls="' + painel.id + '"]');
      if (aba) aba.click();
    }
    var det = el.querySelector('details');
    if (det && el.classList.contains('faq-item')) det.open = true;
    if (el.tagName === 'DETAILS') el.open = true;
    el.setAttribute('tabindex', '-1');
    el.scrollIntoView({ block: 'start' });
    el.focus({ preventScroll: true });
  };

  /* Copia texto: API de área de transferência; alternativa com execCommand; por fim, avisa para copiar manualmente. */
  CME.copiar = function (texto, botao, rotuloOk) {
    function ok() {
      CME.anunciar(rotuloOk || 'Copiado para a área de transferência.');
      if (botao) {
        var rot = botao.querySelector('[data-rotulo]') || botao;
        if (!rot.getAttribute('data-original')) rot.setAttribute('data-original', rot.textContent);
        rot.textContent = 'Copiado';
        setTimeout(function () { rot.textContent = rot.getAttribute('data-original'); }, 1800);
      }
    }
    function alternativa() {
      var ta = document.createElement('textarea');
      ta.value = texto;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.top = '0';
      document.body.appendChild(ta);
      ta.select();
      var feito = false;
      try { feito = document.execCommand('copy'); } catch (e) { feito = false; }
      document.body.removeChild(ta);
      if (botao) botao.focus();
      if (feito) ok(); else CME.anunciar('Não foi possível copiar automaticamente. Selecione o texto e use Ctrl+C.');
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(ok, alternativa);
    } else {
      alternativa();
    }
  };

  CME.pronto = function (fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  CME.pronto(function () {
    document.documentElement.classList.remove('no-js');
    iniciarTema();
    iniciarMenu();
    iniciarVoltarTopo();
    iniciarRodape();
    /* Links internos (#reuniao-…, #doc-…) clicados na mesma página: destaca e leva o foco ao alvo. */
    window.addEventListener('hashchange', function () { setTimeout(CME.focarAlvo, 0); });
  });
})();
