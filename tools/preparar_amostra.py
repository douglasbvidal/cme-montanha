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
NAO_COPIAR = {'_amostra', '_relatorios', 'data', 'docs', 'calendario.ics', '.git', '.github', 'tools', '_site'}


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
        })

    reunioes = [
        {'data': d(-45), 'tipo': 'ordinária', 'numero': 'EX-1', 'local': 'Local de exemplo (fictício)', 'status': 'realizada', 'pauta_id': 'ex-10', 'ata_id': 'ex-12'},
        {'data': d(-5), 'tipo': 'extraordinária', 'numero': 'EX-2', 'local': 'Local de exemplo (fictício)', 'status': 'realizada', 'pauta_id': 'ex-11', 'ata_id': None},
        {'data': d(-15), 'tipo': 'ordinária', 'numero': 'EX-3', 'local': 'Local de exemplo (fictício)', 'status': 'cancelada', 'pauta_id': None, 'ata_id': None},
        {'data': d(12), 'tipo': 'ordinaria', 'numero': None, 'local': None, 'status': 'prevista', 'pauta_id': None, 'ata_id': None,
         'reservada': False, 'observacao_publica': 'Observação pública de exemplo: data a confirmar.'},
        {'data': d(-25), 'tipo': 'extraordinaria', 'numero': None, 'local': None, 'status': 'realizada', 'pauta_id': None, 'ata_id': None,
         'reservada': True, 'observacao_publica': ''},
        {'data': d(40), 'tipo': 'extraordinária', 'numero': 'EX-5', 'local': 'Local de exemplo (fictício)', 'status': 'convocada', 'pauta_id': None, 'ata_id': None},
    ]
    conselheiros = [
        {'nome': 'Pessoa de exemplo A', 'segmento': 'Segmento de exemplo 1', 'entidade': 'Entidade de exemplo', 'condicao': 'titular', 'cargo_mesa': 'Cargo de exemplo', 'mandato': 'Mandato de exemplo', 'fonte': 'Ato de exemplo'},
        {'nome': 'Pessoa de exemplo B', 'segmento': 'Segmento de exemplo 1', 'entidade': 'Entidade de exemplo', 'condicao': 'suplente', 'cargo_mesa': '', 'mandato': 'Mandato de exemplo', 'fonte': 'Ato de exemplo'},
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
                          'itens_de_exemplo': ['Item de exemplo 1', {'titulo': 'Item de exemplo 2', 'texto': 'Descrição de exemplo.'}]},
        'links_uteis': {
            'verificados': [{'titulo': 'Link de exemplo', 'url': 'https://example.org/', 'descricao': 'Descrição de exemplo (domínio reservado para testes).'},
                            {'titulo': 'Link inválido de exemplo (não deve aparecer)', 'url': 'javascript:alert(1)', 'descricao': 'Teste de segurança.'}],
            'candidatos_nao_verificados': [{'titulo': 'Candidato não verificado (não deve aparecer)', 'url': 'https://example.com/'}],
        },
    }

    (DEST / 'data').mkdir(exist_ok=True)
    for nome, obj in [('documentos', docs), ('reunioes', reunioes), ('conselheiros', conselheiros), ('conteudo', conteudo)]:
        (DEST / 'data' / f'{nome}.json').write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')

    linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CME Montanha//Amostra//PT-BR', 'CALSCALE:GREGORIAN']
    for i, r in enumerate(reunioes):
        dia = r['data'].replace('-', '')
        linhas += ['BEGIN:VEVENT', f'UID:amostra-{i}@exemplo.invalid', f'DTSTAMP:{hoje:%Y%m%d}T000000Z',
                   f'DTSTART;VALUE=DATE:{dia}', f'SUMMARY:Reunião de exemplo {r["numero"]}', 'END:VEVENT']
    linhas.append('END:VCALENDAR')
    (DEST / 'calendario.ics').write_text('\r\n'.join(linhas) + '\r\n', encoding='utf-8', newline='')
    print(f'Amostra pronta em {DEST} ({len(docs)} documentos, {len(reunioes)} reuniões).')


if __name__ == '__main__':
    main()
