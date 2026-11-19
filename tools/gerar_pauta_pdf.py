"""Gera PDF de pauta no modelo institucional do CME a partir de uma especificação JSON.

Uso:  python tools/gerar_pauta_pdf.py <spec.json> [<spec2.json> ...]

A especificação descreve APENAS o que consta da fonte (nada é inventado):
{
  "saida": "_revisao/pautas/pauta-2026-09-09-extraordinaria.pdf",
  "titulo": "PAUTA DA REUNIÃO EXTRAORDINÁRIA",
  "numero": null,                      # só se a fonte informar
  "natureza": "texto do aviso de natureza (reprodução, transcrição etc.)" ou null,
  "dados": [["Data", "09/09/2026"], ["Horário", "17h30"], ...],   # só campos da fonte
  "secoes": [{"titulo": "Pauta", "itens": ["...", {"texto": "...", "subitens": ["..."]}], "ordenada": false}],
  "assinatura_original": "Nome — cargo (como consta da fonte)" ou null,
  "fonte": "procedência do conteúdo",
  "rodape": "texto curto do rodapé (natureza da cópia)"
}
Saída: PDF A4 com texto pesquisável, numeração "Página X de N" e metadados básicos.
Requer Google Chrome (headless) e PyMuPDF (fitz). Não acrescenta assinatura, rubrica ou selo."""
import html
import json
import os
import subprocess
import sys
import tempfile

import fitz  # PyMuPDF

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELO = os.path.join(RAIZ, "tools", "modelos", "pauta.html")
CHROME = [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
          r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"]


def e(t):
    return html.escape(str(t), quote=False)


def lista(itens, ordenada):
    tag = "ol" if ordenada else "ul"
    out = [f"<{tag}>"]
    for it in itens:
        if isinstance(it, dict):
            sub = lista(it.get("subitens", []), it.get("subordenada", False)) if it.get("subitens") else ""
            out.append(f"<li>{e(it['texto'])}{sub}</li>")
        else:
            out.append(f"<li>{e(it)}</li>")
    out.append(f"</{tag}>")
    return "".join(out)


def montar_html(s):
    m = open(MODELO, encoding="utf-8").read()
    corpo = "".join(f"<h2>{e(sec['titulo'])}</h2>" + lista(sec["itens"], sec.get("ordenada", False)) for sec in s["secoes"])
    dados = "".join(f"<tr><th scope=\"row\">{e(k)}</th><td>{e(v)}</td></tr>" for k, v in s["dados"])
    rep = {
        "{{TITULO_DOC}}": e(s["titulo"] + " — CME Montanha"),
        "{{TITULO}}": e(s["titulo"]),
        "{{NUMERO}}": f'<p class="numero">{e(s["numero"])}</p>' if s.get("numero") else "",
        "{{NATUREZA}}": f'<p class="natureza"><strong>Natureza do documento:</strong> {e(s["natureza"])}</p>' if s.get("natureza") else "",
        "{{DADOS}}": dados,
        "{{CORPO}}": corpo,
        "{{ASSINATURA}}": f'<p class="assinatura-original">Conforme o original: {e(s["assinatura_original"])}</p>' if s.get("assinatura_original") else "",
        "{{FONTE}}": "<strong>Fonte:</strong> " + e(s["fonte"]),
    }
    for k, v in rep.items():
        m = m.replace(k, v)
    return m


def chrome():
    for c in CHROME:
        if os.path.exists(c):
            return c
    sys.exit("Google Chrome não encontrado.")


def gerar(spec_path):
    s = json.load(open(spec_path, encoding="utf-8"))
    saida = os.path.join(RAIZ, s["saida"]) if not os.path.isabs(s["saida"]) else s["saida"]
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        h = os.path.join(tmp, "pauta.html")
        open(h, "w", encoding="utf-8").write(montar_html(s))
        bruto = os.path.join(tmp, "bruto.pdf")
        perfil = os.path.join(tmp, "perfil")
        subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={perfil}",
                        "--no-pdf-header-footer", f"--print-to-pdf={bruto}", "file:///" + h.replace("\\", "/")],
                       check=True, capture_output=True, timeout=120)
        doc = fitz.open(bruto)
        n = len(doc)
        for i, pg in enumerate(doc, 1):
            r = pg.rect
            # fonte base-14 (Latin-1): sem travessão; usar hífen
            texto = f"CME Montanha/ES - {s.get('rodape', '')}".strip(" -").replace("—", "-").replace("–", "-")
            pg.insert_textbox(fitz.Rect(56, r.height - 46, r.width - 140, r.height - 22), texto, fontsize=7.5,
                              fontname="helv", color=(0.25, 0.25, 0.25))
            pg.insert_textbox(fitz.Rect(r.width - 140, r.height - 46, r.width - 56, r.height - 22),
                              f"Página {i} de {n}", fontsize=7.5, fontname="helv", align=fitz.TEXT_ALIGN_RIGHT,
                              color=(0.25, 0.25, 0.25))
        doc.set_metadata({"title": s["titulo"] + " — " + dict(s["dados"]).get("Data", ""),
                          "author": "Conselho Municipal de Educação de Montanha/ES",
                          "subject": (s.get("natureza") or "Pauta de reunião")[:200],
                          "creator": "tools/gerar_pauta_pdf.py", "producer": "PyMuPDF", "keywords": "CME Montanha; pauta"})
        doc.save(saida, garbage=4, deflate=True)
        doc.close()
    chk = fitz.open(saida)
    txt = "".join(p.get_text() for p in chk)
    paginas = len(chk)
    chk.close()
    assert len(txt.strip()) > 50, "PDF sem texto selecionável"
    print(f"{saida}: {paginas} página(s), {os.path.getsize(saida)//1024} KB")


if __name__ == "__main__":
    for a in sys.argv[1:]:
        gerar(a)
