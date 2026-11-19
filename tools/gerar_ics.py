"""Gera calendario.ics a partir de data/reunioes.json (Python stdlib).
Uso: python tools/gerar_ics.py
Eventos de dia inteiro (o horário de cada reunião vem na convocação).
Datas sem registro de realização não entram no calendário."""
import json
import os
from datetime import date, datetime, timedelta, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
reunioes = json.load(open(os.path.join(RAIZ, "data", "reunioes.json"), encoding="utf-8"))
STATUS = {"realizada": "CONFIRMED", "convocada": "CONFIRMED", "prevista": "TENTATIVE",
          "cancelada": "CANCELLED", "sem_quorum": "CONFIRMED"}


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


agora = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CME Montanha//Calendario de reunioes//PT-BR",
     "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:CME Montanha — Reuniões", "X-WR-TIMEZONE:America/Sao_Paulo"]
for i, r in enumerate(reunioes):
    st = r.get("status")
    if st not in STATUS:
        continue
    d = date.fromisoformat(r["data"])
    tipo = r.get("tipo") or "reunião"
    num = f"{r['numero']}ª " if r.get("numero") else ""
    titulo = f"CME Montanha — {num}reunião {tipo}" if tipo not in ("posse", "sessão plenária") else f"CME Montanha — {tipo}"
    if r.get("reservada"):
        titulo += " (sessão reservada)"
    if st == "cancelada":
        titulo += " (cancelada)"
    desc = [] if r.get("reservada") else [x for x in [r.get("observacao_publica")] if x]
    L += ["BEGIN:VEVENT", f"UID:cme-montanha-{r['data']}-{i}@douglasbvidal.github.io", f"DTSTAMP:{agora}",
          f"DTSTART;VALUE=DATE:{d:%Y%m%d}", f"DTEND;VALUE=DATE:{d + timedelta(days=1):%Y%m%d}",
          dobra("SUMMARY:" + esc(titulo)), f"STATUS:{STATUS[st]}"]
    if r.get("local"):
        L.append(dobra("LOCATION:" + esc(r["local"] + ", Montanha/ES")))
    if desc:
        L.append(dobra("DESCRIPTION:" + esc(" ".join(desc))))
    L.append("END:VEVENT")
L.append("END:VCALENDAR")
open(os.path.join(RAIZ, "calendario.ics"), "w", encoding="utf-8", newline="").write("\r\n".join(L) + "\r\n")
print("calendario.ics:", sum(1 for x in L if x == "BEGIN:VEVENT"), "eventos")
