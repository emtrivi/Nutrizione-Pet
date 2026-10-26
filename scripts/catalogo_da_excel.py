#!/usr/bin/env python3
"""Aggiunge al catalogo alimenti le voci nuove scritte nel foglio Excel della nutrizionista.

Uso:
  python3 scripts/catalogo_da_excel.py FILE.xlsx CATALOGO_BASE.json CATALOGO_NUOVO.json \
      [--forma-vitamina-e CODICE=forma ...]

Regole:
- Le voci già presenti (stesso Codice) devono essere identiche al catalogo base: se un valore
  è cambiato lo script si ferma e lo elenca (le modifiche vanno confermate a parte).
- Una voce del catalogo base che manca nel foglio ferma lo script (non si cancella nulla).
- Le voci nuove vengono aggiunte in fondo. Cella vuota = dato non noto (mai zero).
- Vitamina E in mg senza forma: lo script si ferma, a meno di --forma-vitamina-e.
Richiede openpyxl.
"""

import argparse
import json
import sys

from openpyxl import load_workbook

TIPI = {
    'Carne (muscolo)': ('animal', 'muscle'), 'Pesce': ('animal', 'fish'), 'Uova': ('animal', 'egg'),
    'Cuore': ('animal', 'heart'), 'Fegato': ('animal', 'secreting_offal_liver'), 'Rene': ('animal', 'secreting_offal_kidney'),
    'Milza': ('animal', 'secreting_offal_spleen'), 'Altre frattaglie': ('animal', 'secreting_offal_other'),
    'Cereale': ('starch', 'cereal'), 'Legume': ('starch', 'legume'), 'Tubero': ('starch', 'tuber'),
    'Verdura': ('vegetable', 'vegetable_generic'), 'Olio o grasso': ('other', 'fat_oil'),
}
STATI = {'Crudo': 'raw', 'Bollito': 'cooked_boiled', 'Cotto al vapore': 'cooked_steamed', 'Secco': 'dried', 'In scatola': 'canned'}
AFFIDABILITA = {'Normale': 'estimated', 'Indicativo (da rivedere)': 'review_required'}
SI_NO = {'Sì': True, 'Si': True, 'No': False}
FORME_VIT_E = {
    'Naturale (d-alfa-tocoferolo)': 'd_alpha_tocopherol',
    'd-alfa-tocoferil acetato': 'd_alpha_tocopheryl_acetate',
    'Sintetica (dl-alfa-tocoferolo)': 'dl_alpha_tocopherol',
    'Sintetica acetato (dl-alfa-tocoferil acetato)': 'dl_alpha_tocopheryl_acetate',
}
# Colonne descrittive: (nome tecnico nella seconda riga, campo del catalogo)
CAMPI = {'id': 'id', 'name_it': 'name_it', 'preparation': 'preparation', 'edible_portion': 'edible_portion',
         'kcal_me_per_100g': 'kcal_me_per_100g', 'me_method': 'me_method', 'source': 'source',
         'source_url': 'source_url', 'source_version': 'source_version', 'notes': 'notes'}
SPECIALI = {'Tipo', 'Stato', 'Affidabilità', 'Si può usare nelle ricette', 'Forma della vitamina E'}


def leggi_foglio(path):
    ws = load_workbook(path, data_only=True)['Alimenti']
    titoli = [c.value for c in ws[1]]
    chiavi = [c.value for c in ws[2]]
    righe = []
    for n, r in enumerate(ws.iter_rows(min_row=3, values_only=True), 3):
        if all(v in (None, '') for v in r):
            continue
        righe.append((n, dict(zip(chiavi, r))))
    unita = {}
    for t, k in zip(titoli, chiavi):
        if k not in CAMPI and k not in SPECIALI:
            unita[k] = t.rsplit('(', 1)[1].split('/')[0].replace('UI', 'IU')
    return righe, unita


def vuoto(v):
    return v is None or (isinstance(v, str) and v.strip() == '')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('excel')
    ap.add_argument('base')
    ap.add_argument('uscita')
    ap.add_argument('--forma-vitamina-e', action='append', default=[])
    a = ap.parse_args()
    forme_extra = dict(x.split('=', 1) for x in a.forma_vitamina_e)

    base = json.load(open(a.base, encoding='utf-8'))
    esistenti = {f['id']: f for f in base['foods']}
    righe, unita = leggi_foglio(a.excel)
    errori, nuove, visti = [], [], set()

    for n, r in righe:
        codice = r['id']
        if vuoto(codice):
            errori.append(f'riga {n}: manca il Codice')
            continue
        if codice in visti:
            errori.append(f'riga {n}: Codice {codice} ripetuto')
        visti.add(codice)
        if codice in esistenti:
            f = esistenti[codice]
            for k, u in unita.items():
                attuale = f['nutrients'].get(k, {}).get('value')
                if r.get(k) != attuale:
                    errori.append(f'{codice}: {k} cambiato da {attuale} a {r.get(k)}')
            if r['kcal_me_per_100g'] != f['kcal_me_per_100g']:
                errori.append(f'{codice}: kcal cambiate da {f["kcal_me_per_100g"]} a {r["kcal_me_per_100g"]}')
            continue
        nuove.append((n, r))

    for codice in esistenti:
        if codice not in visti:
            errori.append(f'{codice}: voce del catalogo assente dal foglio (non si cancella nulla)')

    nomi = {f['name_it'].strip().lower() for f in base['foods']}
    cibi = []
    for n, r in nuove:
        codice = r['id']
        obbligatori = ['name_it', 'Tipo', 'Stato', 'kcal_me_per_100g', 'source', 'Affidabilità', 'Si può usare nelle ricette']
        mancanti = [k for k in obbligatori if vuoto(r.get(k))]
        if mancanti:
            errori.append(f'riga {n} ({codice}): mancano {", ".join(mancanti)}')
            continue
        if r['name_it'].strip().lower() in nomi:
            errori.append(f'riga {n} ({codice}): nome già presente nel catalogo')
        if not str(codice).replace('_', '').isalnum() or not str(codice).isascii():
            errori.append(f'riga {n}: Codice {codice} non valido (solo lettere, numeri e _)')
        try:
            categoria, sottocategoria = TIPI[r['Tipo']]
            stato = STATI[r['Stato']]
            affidabilita = AFFIDABILITA[r['Affidabilità']]
            usabile = SI_NO[r['Si può usare nelle ricette']]
        except KeyError as e:
            errori.append(f'riga {n} ({codice}): valore non ammesso {e}')
            continue
        fonte = r['source']
        nutrienti = {}
        for k, u in unita.items():
            v = r.get(k)
            if vuoto(v):
                continue
            if not isinstance(v, (int, float)) or v < 0:
                errori.append(f'riga {n} ({codice}): {k} = {v!r} non è un numero valido')
                continue
            nutrienti[k] = {'value': v, 'unit': u, 'status': 'estimated',
                            'source': fonte}
        if 'vitamin_e' in nutrienti:
            forma = FORME_VIT_E.get(r.get('Forma della vitamina E') or '') or forme_extra.get(codice)
            if not forma:
                errori.append(f'riga {n} ({codice}): vitamina E in mg senza forma')
            else:
                nutrienti['vitamin_e']['form'] = forma
                if codice in forme_extra and vuoto(r.get('Forma della vitamina E')):
                    nutrienti['vitamin_e']['method'] = f'Forma {forma} indicata all’importazione (cella vuota nel foglio).'
        cibo = {
            'id': codice, 'name_it': r['name_it'].strip(), 'category': categoria, 'subcategory': sottocategoria,
            'processing_state': stato,
        }
        for k in ('preparation', 'edible_portion', 'source', 'source_url', 'source_version'):
            cibo[k] = None if vuoto(r.get(k)) else str(r[k]).strip()
        cibo.update({'data_status': affidabilita, 'available_to_formulate': usabile,
                     'notes': None if vuoto(r.get('notes')) else r['notes'].strip(),
                     'nutrients': nutrienti, 'kcal_me_per_100g': r['kcal_me_per_100g'],
                     'me_method': None if vuoto(r.get('me_method')) else r['me_method'].strip()})
        cibi.append(cibo)

    if errori:
        print('Importazione fermata:', *errori, sep='\n  ')
        sys.exit(1)
    uscita = dict(base)
    uscita['foods'] = base['foods'] + cibi
    with open(a.uscita, 'w', encoding='utf-8') as fh:
        json.dump(uscita, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    print(f'Voci invariate: {len(base["foods"])}. Voci nuove: {", ".join(c["id"] for c in cibi) or "nessuna"}.')


if __name__ == '__main__':
    main()
