# -*- coding: utf-8 -*-
"""Monta _amostra/: cópia do site + dados de AMOSTRA claramente fictícios, só para teste local.

Uso:  python tools/preparar_amostra.py
Depois: python -m http.server 8765 --directory _amostra

_amostra/ está no .gitignore e não é publicada. Não usa nomes, números ou endereços reais:
todos os textos dizem "de exemplo". Somente biblioteca padrão.
"""
import datetime as dt
import hashlib
import json
import shutil
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DEST = RAIZ / '_amostra'
NAO_COPIAR = {'_amostra', '_relatorios', '_revisao', 'data', 'docs', 'calendario.ics', '.git', '.github', 'tools', '_site'}


def pdf_minimo(texto):
    """PDF de 1 página com uma linha de texto (Helvetica), válido e pequeno."""
    conteudo = f'BT /F1 18 Tf 60 760 Td ({texto}) Tj ET'.encode('latin-1')
    objs = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        b'<< /Length ' + str(len(conteudo)).encode() + b' >>\nstream\n' + conteudo + b'\nendstream',
    ]
    out = bytearray(b'%PDF-1.4\n')
    offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += f'{i} 0 obj\n'.encode() + o + b'\nendobj\n'
    xref = len(out)
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'.encode()
    for o in offs:
        out += f'{o:010d} 00000 n \n'.encode()
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    return bytes(out)


def main():
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
    for item in RAIZ.iterdir():
        if item.name in NAO_COPIAR:
            continue
        if item.is_dir():
            shutil.copytree(item, DEST / item.name)
        else:
            shutil.copy2(item, DEST / item.name)

    hoje = dt.date.today()
    def d(dias):
        return (hoje + dt.timedelta(days=dias)).isoformat()

    especs = [
        ('legislacao', 'vigente', -400), ('legislacao', 'referencia', -900), ('regimento', 'em_estudo', -60),
        ('resolucoes', 'vigente', -300), ('resolucoes', 'assinado', -30), ('pareceres', 'enviado', -20),
        ('pareceres', 'assinado', -500), ('oficios', 'enviado', -10), ('oficios', 'enviado', -200),
        ('pautas', 'referencia', -45), ('pautas', 'referencia', -5), ('atas', 'assinado', -40),
        ('outros', 'referencia', None),
    ]
    docs = []
    for n, (cat, status, dias) in enumerate(especs, 1):
        nome = f'exemplo-{n:02d}.pdf'
        caminho = DEST / 'docs' / cat / nome
        caminho.parent.mkdir(parents=True, exist_ok=True)
        dados = pdf_minimo(f'Documento de exemplo {n:02d} - arquivo ficticio para teste')
        caminho.write_bytes(dados)
        data = d(dias) if dias is not None else None
        docs.append({
            'id': f'ex-{n:02d}', 'categoria': cat,
            'titulo': f'Documento de exemplo {n:02d} ({cat})',
            'numero': f'EX-{n:02d}', 'ano': int(data[:4]) if data else None, 'data': data,
            'emissor': 'Emissor de exemplo',
            'assunto': f'Assunto de exemplo número {n} para testar filtros, busca e ordenação (dado fictício).',
            'arquivo': f'docs/{cat}/{nome}', 'tamanho_kb': round(len(dados) / 1024, 1), 'paginas': 1,
            'status': status, 'fonte_original': 'Fonte de exemplo (fictícia)',
            'sha256': hashlib.sha256(dados).hexdigest(),
            'observacao': 'Observação de exemplo: situação fictícia para testar o aviso do regimento.' if cat == 'regimento' else '',
        })
    # documento com caminho local em fonte_original (o site não deve exibir)
    docs[0]['fonte_original'] = 'C:\\Pasta\\de\\exemplo\\arquivo.docx'
    # ofício com observação de tarja
    docs[7]['observacao'] = 'Observação de exemplo: cópia com tarja de dados pessoais.'
    # documentos de outro órgão: só link oficial (domínio reservado para testes)
    for n in (14, 15):
        docs.append({
            'id': f'ex-{n:02d}', 'categoria': 'legislacao', 'titulo': f'Documento externo de exemplo {n:02d}',
            'numero': f'EX-{n:02d}', 'ano': int(d(-700)[:4]), 'data': d(-700 - n), 'emissor': 'Órgão externo de exemplo',
            'assunto': 'Ato de outro órgão, apenas linkado (dado fictício).', 'arquivo': None, 'tamanho_kb': None,
            'paginas': None, 'status': 'vigente', 'fonte_original': 'Fonte de exemplo', 'sha256': None,
            'observacao': '', 'externo': True, 'url': f'https://example.org/ato-{n}',
            'estado_documental': 'referencia_externa',
        })

    # ids das reuniões: explícitos e, em duas delas na mesma data, o identificador automático data+tipo
    id_r2 = f'{d(-5)}-extraordinaria'
    # campos novos (opcionais) em alguns documentos, para testar selos, filtros e relações
    def doc(i):
        return next(x for x in docs if x['id'] == i)
    doc('ex-04').update({'numero': '004/2026', 'titulo': 'Resolução de exemplo nº 004/2026 (resolucoes)',
                         'estado_documental': 'original_assinado', 'estado_deliberativo': 'aprovado_plenario',
                         'estado_homologacao': 'homologado', 'estado_publicacao': 'publicado_dom', 'estado_vigencia': 'vigente',
                         'data_publicacao_oficial': d(-295), 'fonte_publicacao_oficial': 'Diário oficial de exemplo, ed. 0, p. 0',
                         'url_publicacao_oficial': 'https://example.org/diario-exemplo', 'data_indexacao': d(-2)})
    doc('ex-05').update({'estado_documental': 'original_assinado', 'estado_publicacao': 'publicado_neste_portal',
                         'paginas_no_arquivo': 'p. 1', 'data_indexacao': d(-1)})
    doc('ex-06').update({'estado_documental': 'original_sem_assinatura', 'estado_deliberativo': 'emitido_ad_referendum',
                         'estado_homologacao': 'nao_exigida', 'estado_publicacao': 'nao_publicado_oficialmente',
                         'pendencia_verificacao': 'Referendo pelo Plenário de exemplo ainda não conferido.',
                         'documento_relacionado': ['ex-04'], 'observacao_publica': 'Observação pública de exemplo.'})
    doc('ex-10').update({'reuniao_id': 'ex-r1', 'natureza_pauta': 'original'})
    doc('ex-11').update({'reuniao_id': id_r2, 'natureza_pauta': 'reproducao_digital'})
    doc('ex-12').update({'reuniao_id': 'ex-r1', 'estado_deliberativo': 'aprovado_plenario'})
    # segundo registro dentro do mesmo PDF da resolução ex-05 (paginas_no_arquivo)
    base5 = doc('ex-05')
    docs.append(dict(base5, id='ex-17', titulo='Parecer de exemplo contido no mesmo arquivo (pareceres)', categoria='pareceres',
                     numero='5/2026', paginas_no_arquivo='p. 1 (segunda parte)', documento_relacionado=['ex-05']))
    # convocação (categoria nova)
    nome = 'exemplo-16.pdf'
    dados = pdf_minimo('Convocacao de exemplo 16 - arquivo ficticio para teste')
    (DEST / 'docs' / 'convocacoes').mkdir(parents=True, exist_ok=True)
    (DEST / 'docs' / 'convocacoes' / nome).write_bytes(dados)
    docs.append({'id': 'ex-16', 'categoria': 'convocacoes', 'titulo': 'Convocação de exemplo 16 (convocacoes)', 'numero': None,
                 'ano': int(d(-50)[:4]), 'data': d(-50), 'emissor': 'Emissor de exemplo', 'assunto': 'Convocação fictícia para teste.',
                 'arquivo': f'docs/convocacoes/{nome}', 'tamanho_kb': round(len(dados) / 1024, 1), 'paginas': 1,
                 'status': 'referencia', 'fonte_original': 'Fonte de exemplo (fictícia)', 'sha256': hashlib.sha256(dados).hexdigest(),
                 'observacao': '', 'reuniao_id': 'ex-r1', 'data_indexacao': d(-3)})

    reunioes = [
        {'id': 'ex-r1', 'data': d(-45), 'tipo': 'ordinária', 'numero': 1, 'local': 'Local de exemplo (fictício)', 'status': 'realizada',
         'horario': '9h', 'modalidade': 'presencial', 'pauta_id': 'ex-10', 'ata_id': 'ex-12', 'convocacao_id': 'ex-16',
         'documentos_relacionados': ['ex-04']},
        {'data': d(-5), 'tipo': 'extraordinária', 'numero': None, 'local': 'Local de exemplo (fictício)', 'status': 'realizada', 'pauta_id': 'ex-11', 'ata_id': None},
        {'data': d(-5), 'tipo': 'ordinária', 'numero': None, 'local': None, 'status': 'realizada', 'pauta_id': None, 'ata_id': None,
         'observacao_publica': 'Segunda reunião de exemplo na mesma data.'},
        {'id': 'ex-r3', 'data': d(-15), 'tipo': 'ordinária', 'numero': None, 'local': 'Local de exemplo (fictício)', 'status': 'cancelada', 'pauta_id': None, 'ata_id': None},
        {'id': 'ex-r4', 'data': d(12), 'tipo': 'ordinaria', 'numero': None, 'local': None, 'status': 'prevista', 'pauta_id': None, 'ata_id': None,
         'horario': '16h30', 'modalidade': 'hibrida', 'reservada': False, 'observacao_publica': 'Observação pública de exemplo: data a confirmar.'},
        {'id': 'ex-r5', 'data': d(-25), 'tipo': 'extraordinaria', 'numero': None, 'local': 'Local que NÃO deve aparecer', 'status': 'realizada',
         'pauta_id': None, 'ata_id': None, 'reservada': True, 'observacao_publica': 'Observação que NÃO deve aparecer', 'horario': '18h'},
        {'id': 'ex-r6', 'data': d(40), 'tipo': 'extraordinária', 'numero': 5, 'local': 'Local de exemplo (fictício)', 'status': 'convocada', 'pauta_id': None, 'ata_id': None,
         'modalidade': 'remota'},
        {'id': 'ex-r7', 'data': d(-60), 'tipo': 'ordinária', 'numero': None, 'local': None, 'status': 'sem_registro', 'pauta_id': None, 'ata_id': None,
         'observacao_publica': 'Data de calendário de exemplo sem registro de realização.'},
    ]
    conselheiros = [
        {'nome': 'Pessoa de exemplo A', 'segmento': 'Segmento de exemplo 1', 'entidade': 'Entidade de exemplo', 'condicao': 'titular', 'par': 1, 'cargo_mesa': 'Cargo de exemplo', 'mandato': 'Mandato de exemplo', 'fonte': 'Ato de exemplo', 'ato_url': 'https://example.org/ato-nomeacao'},
        {'nome': 'Pessoa de exemplo B', 'segmento': 'Segmento de exemplo 1', 'entidade': None, 'condicao': 'suplente', 'par': 1, 'cargo_mesa': '', 'mandato': 'Mandato de exemplo', 'fonte': 'Ato de exemplo', 'grafia_no_ato': 'Pessoa de Exemplo B (grafia do ato)'},
        {'nome': 'Pessoa de exemplo D', 'segmento': 'Segmento de exemplo 1', 'entidade': None, 'condicao': 'suplente', 'par': 2, 'cargo_mesa': '', 'mandato': 'Mandato de exemplo', 'fonte': 'Ato de exemplo'},
        {'nome': 'Pessoa de exemplo E', 'segmento': 'Segmento de exemplo 1', 'entidade': None, 'condicao': 'titular', 'par': 2, 'cargo_mesa': '', 'mandato': 'Mandato de exemplo', 'fonte': 'Ato de exemplo'},
        {'nome': 'Pessoa de exemplo C', 'segmento': 'Segmento de exemplo 2', 'entidade': 'Entidade de exemplo', 'condicao': 'titular', 'cargo_mesa': '', 'mandato': 'Mandato de exemplo', 'fonte': 'Ato de exemplo'},
    ]
    fonte = 'Fonte de exemplo, art. 0'
    conteudo = {
        'aviso': 'Nota interna de exemplo — NÃO deve aparecer no site.',
        'sobre': {
            'finalidade': [{'texto': 'Texto de exemplo sobre finalidade (fictício).', 'fonte': fonte, 'artigo': 'art. 1º'},
                           {'texto': 'Segundo texto de exemplo sobre finalidade.', 'fonte': 'Fonte de exemplo\\subpasta (relativa)'}],
            'funcionamento': [{'texto': 'Texto de exemplo sobre funcionamento (fictício).', 'fonte': fonte}],
            'regimento': [{'texto': 'Texto de exemplo sobre a situação do regimento (fictício).', 'fonte': fonte}],
            'natureza': 'Texto de exemplo sobre natureza (fictício).',
            'composicao': {'texto': 'Texto de exemplo sobre composição (fictício).', 'fonte': fonte},
            'mandato': {'texto': 'Texto de exemplo sobre mandato (fictício).', 'fonte': fonte},
            'competencias': [{'texto': f'Competência de exemplo {i} (fictícia).', 'fonte': fonte} for i in range(1, 4)],
        },
        'faq': [{'pergunta': f'Pergunta de exemplo {i}?', 'resposta': f'Resposta de exemplo {i} (fictícia).', 'fonte': fonte} for i in range(1, 4)],
        'glossario': [{'termo': t, 'definicao': f'Definição de exemplo para {t} (fictícia).'} for t in ['Ata de exemplo', 'Ênfase de exemplo', 'Parecer de exemplo', 'Quórum de exemplo']],
        'transparencia': {'acesso_a_informacao': {'texto': 'Texto de exemplo sobre acesso à informação (fictício).', 'fonte': fonte},
                          'itens_de_exemplo': ['Item de exemplo 1', {'titulo': 'Item de exemplo 2', 'texto': 'Descrição de exemplo.'}],
                          'como_pedir': [{'texto': 'Texto de exemplo sobre como fazer pedido formal de informação (fictício).', 'fonte': fonte}]},
        'composicao_resumo': {'cadeiras_legais_titulares': 5, 'cadeiras_legais_suplentes': 5, 'titulares_nomeados': 3,
                              'suplentes_nomeados': 2, 'mandato_texto': 'Mandato de exemplo (fictício).',
                              'ato_titulo': 'Ato de nomeação de exemplo', 'ato_url': 'https://example.org/ato-nomeacao', 'fonte': fonte},
        'conselheiros_nota': {'texto': 'Nota de exemplo sobre a situação da composição (fictícia).', 'fonte': fonte},
        'links_uteis': {
            'verificados': [{'titulo': 'Link de exemplo', 'url': 'https://example.org/', 'descricao': 'Descrição de exemplo (domínio reservado para testes).'},
                            {'titulo': 'Ouvidoria e Acesso à Informação de exemplo', 'url': 'https://example.org/ouvidoria', 'descricao': 'Canal de exemplo para pedidos pela LAI.'},
                            {'titulo': 'Link inválido de exemplo (não deve aparecer)', 'url': 'javascript:alert(1)', 'descricao': 'Teste de segurança.'}],
            'candidatos_nao_verificados': [{'titulo': 'Candidato não verificado (não deve aparecer)', 'url': 'https://example.com/'}],
        },
    }

    (DEST / 'data').mkdir(exist_ok=True)
    for nome, obj in [('documentos', docs), ('reunioes', reunioes), ('conselheiros', conselheiros), ('conteudo', conteudo)]:
        (DEST / 'data' / f'{nome}.json').write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')

    # registro de atualização e calendário gerados pelas próprias ferramentas (na pasta da amostra)
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import subprocess
    subprocess.run([sys.executable, str(RAIZ / 'tools' / 'registrar_atualizacao.py'), str(DEST)], check=True, stdout=subprocess.DEVNULL)
    import gerar_ics
    (DEST / 'calendario.ics').write_text(gerar_ics.gerar(DEST), encoding='utf-8', newline='')
    print(f'Amostra pronta em {DEST} ({len(docs)} documentos, {len(reunioes)} reuniões).')


if __name__ == '__main__':
    main()
