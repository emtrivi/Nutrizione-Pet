#!/usr/bin/env python3
"""Aggiunge al catalogo alimenti le voci nuove scritte nel foglio Excel della nutrizionista.

Uso:
  python3 scripts/catalogo_da_excel.py FILE.xlsx CATALOGO_BASE.json CATALOGO_NUOVO.json \
      [--forma-vitamina-e CODICE=forma ...] [--tipo CODICE=Tipo ...] [--kcal-da-proteine-grassi]

Regole:
- Le voci già presenti (stesso Codice) devono essere identiche al catalogo base: se qualcosa è
  cambiato lo script elenca le differenze e si ferma; con --applica-modifiche (dopo la conferma
  dell'utente) le applica. Un nutriente con lo stesso valore tiene fonte e note di prima.
- Una voce del catalogo base che manca nel foglio ferma lo script (non si cancella nulla).
- Le voci nuove vengono aggiunte in fondo. Cella vuota = dato non noto (mai zero).
- Vitamina E in mg senza forma: lo script si ferma, a meno di --forma-vitamina-e.
- --tipo CODICE=Tipo: Tipo da usare quando quello del foglio non è tra i valori ammessi.
- Forma della vitamina E che inizia con "Naturale": d-alfa-tocoferolo, come per gli altri alimenti.
- Voci esistenti con kcal ricalcolate a un'importazione precedente: il valore originale del foglio
  (scritto nel metodo delle kcal) non conta come modifica.
- --kcal-da-proteine-grassi: per le voci nuove le kcal si calcolano come nel resto del catalogo
  (4 kcal/g proteine + 9 kcal/g grassi + 4 kcal/g carboidrati disponibili); il valore del foglio
  resta scritto nel metodo delle kcal.
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
    'Latticini': ('animal', 'dairy'),
}
STATI = {'Crudo': 'raw', 'Bollito': 'cooked_boiled', 'Cotto al vapore': 'cooked_steamed', 'Secco': 'dried', 'In scatola': 'canned'}
AFFIDABILITA = {'Normale': 'estimated', 'Indicativo (da rivedere)': 'review_required', 'Indicativo': 'review_required'}
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


def voce_da_riga(n, r, unita, forme_extra, tipi_extra, kcal_da_proteine_grassi):
    """Voce del catalogo costruita dalla riga del foglio; restituisce (voce, errori)."""
    codice = r['id']
    errori = []
    obbligatori = ['name_it', 'Tipo', 'Stato', 'kcal_me_per_100g', 'source', 'Affidabilità', 'Si può usare nelle ricette']
    mancanti = [k for k in obbligatori if vuoto(r.get(k))]
    if mancanti:
        return None, [f'riga {n} ({codice}): mancano {", ".join(mancanti)}']
    try:
        categoria, sottocategoria = TIPI[tipi_extra.get(codice, r['Tipo'])]
        stato = STATI[r['Stato']]
        affidabilita = AFFIDABILITA[r['Affidabilità']]
        usabile = SI_NO[r['Si può usare nelle ricette']]
    except KeyError as e:
        return None, [f'riga {n} ({codice}): valore non ammesso {e}']
    fonte = str(r['source']).strip()
    nutrienti = {}
    for k, u in unita.items():
        v = r.get(k)
        if vuoto(v):
            continue
        if not isinstance(v, (int, float)) or v < 0:
            errori.append(f'riga {n} ({codice}): {k} = {v!r} non è un numero valido')
            continue
        nutrienti[k] = {'value': v, 'unit': u, 'status': 'estimated', 'source': fonte}
    if 'vitamin_e' in nutrienti:
        testo = r.get('Forma della vitamina E') or ''
        forma = FORME_VIT_E.get(testo) or forme_extra.get(codice) or ('d_alpha_tocopherol' if testo.startswith('Naturale') else None)
        if not forma:
            errori.append(f'riga {n} ({codice}): vitamina E in mg senza forma')
        else:
            nutrienti['vitamin_e']['form'] = forma
            if codice in forme_extra and vuoto(r.get('Forma della vitamina E')):
                nutrienti['vitamin_e']['method'] = f'Forma {forma} indicata all’importazione (cella vuota nel foglio).'
    kcal, metodo = r['kcal_me_per_100g'], None if vuoto(r.get('me_method')) else str(r['me_method']).strip()
    if kcal_da_proteine_grassi:
        if 'protein' not in nutrienti or 'fat' not in nutrienti:
            return None, errori + [f'riga {n} ({codice}): servono proteine e grassi per calcolare le kcal']
        carb = nutrienti.get('carbohydrate_available', {}).get('value', 0)
        kcal = round(4 * nutrienti['protein']['value'] + 9 * nutrienti['fat']['value'] + 4 * carb, 1)
        metodo = (f'Stima 4 kcal/g proteine + 9 kcal/g grassi + 4 kcal/g carboidrati disponibili, come il resto del catalogo; '
                  f'non energia metabolizzabile misurata. Valore nel foglio: {r["kcal_me_per_100g"]} kcal/100 g'
                  + (f' ({metodo})' if metodo else '') + ', non usato.')
    cibo = {
        'id': codice, 'name_it': str(r['name_it']).strip(), 'category': categoria, 'subcategory': sottocategoria,
        'processing_state': stato,
    }
    for k in ('preparation', 'edible_portion', 'source', 'source_url', 'source_version'):
        cibo[k] = None if vuoto(r.get(k)) else str(r[k]).strip()
    cibo.update({'data_status': affidabilita, 'available_to_formulate': usabile,
                 'notes': None if vuoto(r.get('notes')) else str(r['notes']).strip(),
                 'nutrients': nutrienti, 'kcal_me_per_100g': kcal, 'me_method': metodo})
    return cibo, errori


def unisci(vecchia, nuova):
    """Voce esistente aggiornata con i valori del foglio. Un nutriente con lo stesso valore tiene fonte e note di
    prima; le kcal già ricalcolate a un'importazione precedente (valore del foglio scritto nel metodo) restano."""
    out = dict(vecchia)
    for k in ('name_it', 'category', 'subcategory', 'processing_state', 'preparation', 'edible_portion', 'source',
              'source_url', 'source_version', 'data_status', 'available_to_formulate', 'notes'):
        prima = vecchia.get(k)
        if (prima.strip() if isinstance(prima, str) else prima) != nuova[k]:
            out[k] = nuova[k]
    ricalcolate = f'Valore nel foglio: {nuova["kcal_me_per_100g"]} kcal/100 g' in (vecchia.get('me_method') or '')
    if nuova['kcal_me_per_100g'] != vecchia['kcal_me_per_100g'] and not ricalcolate:
        out['kcal_me_per_100g'] = nuova['kcal_me_per_100g']
        out['me_method'] = nuova['me_method']
    elif not ricalcolate and (vecchia.get('me_method') or None) != nuova['me_method']:
        out['me_method'] = nuova['me_method']
    nutrienti = {}
    for k, v in nuova['nutrients'].items():
        p = vecchia['nutrients'].get(k)
        uguale = p is not None and p['value'] == v['value'] and (k != 'vitamin_e' or p.get('form') == v.get('form'))
        nutrienti[k] = p if uguale else v
    out['nutrients'] = nutrienti
    return out


def differenze(vecchia, nuova):
    righe = []
    for k in sorted(set(vecchia) | set(nuova)):
        if k == 'nutrients':
            continue
        if vecchia.get(k) != nuova.get(k):
            righe.append(f'{k}: {str(vecchia.get(k))[:60]!r} → {str(nuova.get(k))[:60]!r}')
    vn, nn = vecchia['nutrients'], nuova['nutrients']
    for k in sorted(set(vn) | set(nn)):
        a, b = vn.get(k, {}).get('value'), nn.get(k, {}).get('value')
        if a != b or (k == 'vitamin_e' and vn.get(k, {}).get('form') != nn.get(k, {}).get('form')):
            righe.append(f'{k}: {a} → {b}')
    return righe


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('excel')
    ap.add_argument('base')
    ap.add_argument('uscita')
    ap.add_argument('--forma-vitamina-e', action='append', default=[])
    ap.add_argument('--tipo', action='append', default=[])
    ap.add_argument('--kcal-da-proteine-grassi', action='store_true')
    ap.add_argument('--applica-modifiche', action='store_true',
                    help='applica le modifiche alle voci esistenti (solo dopo la conferma dell\'utente)')
    a = ap.parse_args()
    forme_extra = dict(x.split('=', 1) for x in a.forma_vitamina_e)
    tipi_extra = dict(x.split('=', 1) for x in a.tipo)

    base = json.load(open(a.base, encoding='utf-8'))
    esistenti = {f['id']: f for f in base['foods']}
    righe, unita = leggi_foglio(a.excel)
    errori, nuove, visti, modificate = [], [], set(), {}

    for n, r in righe:
        codice = r['id']
        if vuoto(codice):
            errori.append(f'riga {n}: manca il Codice')
            continue
        if codice in visti:
            errori.append(f'riga {n}: Codice {codice} ripetuto')
        visti.add(codice)
        if codice in esistenti:
            cibo, err = voce_da_riga(n, r, unita, forme_extra, tipi_extra, False)
            errori += err
            if cibo is None:
                continue
            unita_voce = unisci(esistenti[codice], cibo)
            if unita_voce != esistenti[codice]:
                modificate[codice] = unita_voce
            continue
        nuove.append((n, r))

    for codice in esistenti:
        if codice not in visti:
            errori.append(f'{codice}: voce del catalogo assente dal foglio (non si cancella nulla)')

    if modificate:
        print(f'Voci esistenti modificate: {len(modificate)}')
        for codice, v in modificate.items():
            print(f'  {codice}:')
            for d in differenze(esistenti[codice], v):
                print(f'    {d}')
        if not a.applica_modifiche:
            errori.append('ci sono modifiche a voci esistenti: confermale e rilancia con --applica-modifiche')

    nomi = {f['name_it'].strip().lower() for f in base['foods']}
    cibi = []
    for n, r in nuove:
        codice = r['id']
        if not str(codice).replace('_', '').isalnum() or not str(codice).isascii():
            errori.append(f'riga {n}: Codice {codice} non valido (solo lettere, numeri e _)')
        if not vuoto(r.get('name_it')) and str(r['name_it']).strip().lower() in nomi:
            errori.append(f'riga {n} ({codice}): nome già presente nel catalogo')
        cibo, err = voce_da_riga(n, r, unita, forme_extra, tipi_extra, a.kcal_da_proteine_grassi)
        errori += err
        if cibo is not None:
            cibi.append(cibo)

    if errori:
        print('Importazione fermata:', *errori, sep='\n  ')
        sys.exit(1)
    uscita = dict(base)
    uscita['foods'] = [modificate.get(f['id'], f) for f in base['foods']] + cibi
    with open(a.uscita, 'w', encoding='utf-8') as fh:
        json.dump(uscita, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    invariate = len(base['foods']) - len(modificate)
    print(f'Voci invariate: {invariate}. Voci modificate: {len(modificate)}. '
          f'Voci nuove: {", ".join(c["id"] for c in cibi) or "nessuna"}.')


if __name__ == '__main__':
    main()
