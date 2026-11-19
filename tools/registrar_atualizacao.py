# -*- coding: utf-8 -*-
"""Registra em data/atualizacao.json a data da última MUDANÇA REAL de cada conjunto de dados públicos.

Uso:
    python tools/registrar_atualizacao.py [pasta_do_site] [--data AAAA-MM-DD] [--verificar]

Conjuntos e o que entra no hash (SHA-256):
    acervo      data/documentos.json + todos os arquivos de docs/ (caminho e conteúdo)
    calendario  data/reunioes.json
    composicao  data/conselheiros.json
    conteudo    data/conteudo.json

Regras:
- A data de um conjunto só muda quando o hash dele muda; sem mudança, nada é reescrito.
- Os JSON são comparados em forma canônica (chaves ordenadas): mudar só espaços ou ordem de chaves
  não conta como mudança.
- --data define a data a gravar para os conjuntos que mudaram (padrão: data de hoje).
- --verificar só confere (não grava); sai com código 1 se algum conjunto mudou sem registro.
Somente biblioteca padrão.
"""
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

CONJUNTOS = [
    ('acervo', ['data/documentos.json'], 'docs'),
    ('calendario', ['data/reunioes.json'], None),
    ('composicao', ['data/conselheiros.json'], None),
    ('conteudo', ['data/conteudo.json'], None),
]
IGNORAR_ARQUIVOS = {'desktop.ini', 'thumbs.db', '.ds_store'}
ARQUIVO = 'data/atualizacao.json'


def bytes_canonicos(p):
    """JSON em forma canônica; se não for JSON válido, os bytes como estão."""
    dados = p.read_bytes()
    try:
        obj = json.loads(dados.decode('utf-8-sig'))
    except (ValueError, UnicodeDecodeError):
        return dados
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def hash_conjunto(raiz, arquivos, pasta=None):
    """SHA-256 do conjunto; None se nenhum arquivo do conjunto existir."""
    raiz = Path(raiz)
    h = hashlib.sha256()
    achou = False
    for rel in arquivos:
        p = raiz / rel
        if p.exists():
            achou = True
            h.update(rel.encode('utf-8') + b'\0' + hashlib.sha256(bytes_canonicos(p)).digest())
    if pasta and (raiz / pasta).is_dir():
        for p in sorted((raiz / pasta).rglob('*'), key=lambda x: x.relative_to(raiz).as_posix()):
            if p.is_file() and p.name.lower() not in IGNORAR_ARQUIVOS:
                achou = True
                h.update(p.relative_to(raiz).as_posix().encode('utf-8') + b'\0' + hashlib.sha256(p.read_bytes()).digest())
    return h.hexdigest() if achou else None


def hashes_atuais(raiz):
    return {nome: hash_conjunto(raiz, arqs, pasta) for nome, arqs, pasta in CONJUNTOS}


def ler_registro(raiz):
    p = Path(raiz) / ARQUIVO
    if not p.exists():
        return {}
    try:
        obj = json.loads(p.read_text(encoding='utf-8-sig'))
        return obj if isinstance(obj, dict) else {}
    except ValueError:
        return {}


def main():
    args, data, verificar = [], date.today().isoformat(), False
    it = iter(sys.argv[1:])
    for a in it:
        if a == '--verificar':
            verificar = True
        elif a == '--data':
            data = next(it, '')
        else:
            args.append(a)
    raiz = Path(args[0]).resolve() if args else Path(__file__).resolve().parent.parent
    try:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', data):
            raise ValueError
        date.fromisoformat(data)
    except ValueError:
        print(f'--data inválida: {data!r} (use AAAA-MM-DD)')
        sys.exit(2)

    antigo = ler_registro(raiz)
    atuais = hashes_atuais(raiz)
    novo, mudaram = {}, []
    for nome, _, _ in CONJUNTOS:
        h = atuais[nome]
        ant = antigo.get(nome) if isinstance(antigo.get(nome), dict) else {}
        if h is None:
            print(f'{nome}: arquivos ausentes; item não registrado.')
            continue
        if ant.get('hash') == h and re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(ant.get('data', ''))):
            novo[nome] = {'data': ant['data'], 'hash': h}
            print(f'{nome}: sem mudança (mantida {ant["data"]})')
        else:
            novo[nome] = {'data': data, 'hash': h}
            mudaram.append(nome)
            print(f'{nome}: MUDOU -> {data}')

    if verificar:
        print('Registro em dia.' if not mudaram else f'Registro desatualizado: {", ".join(mudaram)} (rode sem --verificar).')
        sys.exit(1 if mudaram else 0)

    texto = json.dumps(novo, ensure_ascii=False, indent=2) + '\n'
    p = raiz / ARQUIVO
    if p.exists() and p.read_text(encoding='utf-8-sig') == texto:
        print(f'{ARQUIVO}: nada a gravar.')
        return
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(texto, encoding='utf-8', newline='\n')
    print(f'{ARQUIVO}: gravado ({len(mudaram)} conjunto(s) com mudança).')


if __name__ == '__main__':
    main()
