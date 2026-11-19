# -*- coding: utf-8 -*-
"""Gera calendario.ics a partir de data/reunioes.json (somente biblioteca padrão).

Uso:  python tools/gerar_ics.py [pasta_do_site] [--saida arquivo.ics]

Regras:
- UID estável: "reuniao-<id>@cme-montanha", com <id> = campo "id" da reunião; sem ele, data + tipo
  normalizado (ex.: 2026-11-18-ordinaria). Repetições recebem -2, -3… (mesmo algoritmo do site,
  assets/js/comum.js → CME.idsReunioes). Duas reuniões na mesma data têm UIDs distintos.
- DTSTAMP determinístico: data do conjunto "calendario" em data/atualizacao.json quando o hash
  registrado confere com data/reunioes.json; se reunioes.json mudou e ainda não foi registrado,
  usa a data de hoje (a mesma que tools/registrar_atualizacao.py vai gravar). Sem atualizacao.json,
  usa a data fixa 2025-01-01. Mesmos dados → arquivo idêntico, byte a byte.
- status "sem_registro" não entra; "cancelada" sai com STATUS:CANCELLED; "prevista" com TENTATIVE.
- Com "horario" (ex.: 16h30, 9h, 09:00) o evento tem hora de início (horário de Brasília, UTC−3);
  sem horário, é evento de dia inteiro. Reunião reservada: só data, tipo e situação.
"""
import json
import re
import sys
import unicodedata
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import registrar_atualizacao as reg  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
STATUS = {"realizada": "CONFIRMED", "convocada": "CONFIRMED", "prevista": "TENTATIVE",
          "cancelada": "CANCELLED", "sem_quorum": "CONFIRMED"}
DTSTAMP_PADRAO = "20250101T000000Z"
MODALIDADES = {"presencial": "presencial", "remota": "remota (videoconferência)", "hibrida": "híbrida (presencial e videoconferência)"}


def slug(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:60] or "item"


def ids_reunioes(lista):
    """Mesmo algoritmo de CME.idsReunioes (assets/js/comum.js)."""
    usados, out = set(), []
    for r in lista:
        r = r if isinstance(r, dict) else {}
        rid = r.get("id")
        if isinstance(rid, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", rid):
            base = rid
        elif isinstance(rid, str) and rid.strip():
            base = slug(rid)
        else:
            d = r.get("data")
            d = d if isinstance(d, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", d) else "sem-data"
            base = d + "-" + slug(r.get("tipo") or "reuniao")
        i, n = base, 2
        while i in usados:
            i = f"{base}-{n}"
            n += 1
        usados.add(i)
        out.append(i)
    return out


def horario(v):
    m = re.fullmatch(r"\s*(\d{1,2})\s*[h:]\s*(\d{2})?\s*(?:h|min)?\s*", str(v or ""), re.I)
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2) or 0)
    return (h, mi) if h <= 23 and mi <= 59 else None


def esc(t):
    return str(t).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def dobra(linha):
    b = linha.encode("utf-8")
    out = []
    while len(b) > 74:
        corte = 74
        while (b[corte] & 0xC0) == 0x80:
            corte -= 1
        out.append(b[:corte].decode("utf-8"))
        b = b" " + b[corte:]
    out.append(b.decode("utf-8"))
    return "\r\n".join(out)


def dtstamp(raiz):
    registro = reg.ler_registro(raiz).get("calendario")
    h = reg.hash_conjunto(raiz, ["data/reunioes.json"])
    if isinstance(registro, dict) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(registro.get("data", ""))):
        d = registro["data"] if registro.get("hash") == h else date.today().isoformat()
        return d.replace("-", "") + "T000000Z"
    return DTSTAMP_PADRAO


def titulo(r):
    tipo = str(r.get("tipo") or "reunião").strip()
    if re.match(r"(posse|sess)", slug(tipo)):
        t = tipo[:1].upper() + tipo[1:]
    else:
        num = f"{r['numero']}ª " if isinstance(r.get("numero"), int) else (f"{r['numero']} " if r.get("numero") else "")
        t = f"{num}reunião {tipo}"
    t = "CME Montanha — " + t
    if r.get("reservada") is True:
        t += " (sessão reservada)"
    if r.get("status") == "cancelada":
        t += " (cancelada)"
    elif r.get("status") == "sem_quorum":
        t += " (sem quórum)"
    return t


def gerar(raiz=RAIZ):
    """Devolve o texto do calendário (CRLF) gerado de <raiz>/data/reunioes.json."""
    raiz = Path(raiz)
    reunioes = json.loads((raiz / "data" / "reunioes.json").read_text(encoding="utf-8-sig"))
    try:
        cfg = json.loads((raiz / "site.config.json").read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        cfg = {}
    url_site = str(cfg.get("url_site") or "").strip()
    url_site = url_site.rstrip("/") + "/" if url_site.startswith("https://") else ""
    stamp = dtstamp(raiz)
    ids = ids_reunioes(reunioes)
    itens = []
    for r, rid in zip(reunioes, ids):
        if not isinstance(r, dict) or r.get("status") not in STATUS:
            continue  # sem_registro e status desconhecido não entram
        try:
            d = date.fromisoformat(str(r.get("data")))
        except ValueError:
            continue
        itens.append((d.isoformat(), rid, r, d))
    itens.sort(key=lambda x: (x[0], x[1]))

    L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CME Montanha//Calendario de reunioes//PT-BR",
         "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:CME Montanha — Reuniões",
         "X-WR-TIMEZONE:America/Sao_Paulo"]
    for _, rid, r, d in itens:
        reservada = r.get("reservada") is True
        hor = None if reservada else horario(r.get("horario"))
        L += ["BEGIN:VEVENT", dobra(f"UID:reuniao-{rid}@cme-montanha"), f"DTSTAMP:{stamp}"]
        if hor:
            inicio = datetime(d.year, d.month, d.day, hor[0], hor[1]) + timedelta(hours=3)  # Brasília (UTC−3) → UTC
            L.append(f"DTSTART:{inicio:%Y%m%dT%H%M%S}Z")
        else:
            L += [f"DTSTART;VALUE=DATE:{d:%Y%m%d}", f"DTEND;VALUE=DATE:{d + timedelta(days=1):%Y%m%d}"]
        L += [dobra("SUMMARY:" + esc(titulo(r))), f"STATUS:{STATUS[r['status']]}"]
        if not reservada:
            if r.get("local"):
                L.append(dobra("LOCATION:" + esc(str(r["local"]) + ", Montanha/ES")))
            desc = []
            if r.get("observacao_publica"):
                desc.append(str(r["observacao_publica"]))
            if r.get("modalidade") in MODALIDADES:
                desc.append("Modalidade: " + MODALIDADES[r["modalidade"]] + ".")
            if url_site:
                desc.append("Detalhes, pauta e ata: " + url_site + "reunioes/index.html#reuniao-" + rid)
            if desc:
                L.append(dobra("DESCRIPTION:" + esc("\n".join(desc))))
        if url_site:
            L.append(dobra("URL:" + url_site + "reunioes/index.html#reuniao-" + rid))
        L.append("END:VEVENT")
    L.append("END:VCALENDAR")
    return "\r\n".join(L) + "\r\n"


def main():
    args, saida = [], None
    it = iter(sys.argv[1:])
    for a in it:
        if a == "--saida":
            saida = next(it, None)
        else:
            args.append(a)
    raiz = Path(args[0]).resolve() if args else RAIZ
    texto = gerar(raiz)
    destino = Path(saida) if saida else raiz / "calendario.ics"
    with open(destino, "w", encoding="utf-8", newline="") as f:
        f.write(texto)
    print(f"{destino}: {texto.count('BEGIN:VEVENT')} eventos")


if __name__ == "__main__":
    main()
