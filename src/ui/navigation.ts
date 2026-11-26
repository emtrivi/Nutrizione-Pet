// Percorsi tra Dispensa (scheda in basso) e «Spesa e previsioni» (pagina aperta dalla Dispensa).
// Senza import di expo-router, così si prova nei test.

export const PANTRY_HREF = '/dispensa' as const;
export const SHOPPING_HREF = '/spesa' as const;
export const SHOPPING_BUTTON = 'Spesa e previsioni';
export const BACK_TO_PANTRY_BUTTON = 'Torna alla dispensa';

type Nav = { canGoBack: () => boolean; back: () => void; navigate: (href: typeof PANTRY_HREF) => void };

/** Dalla Spesa alla Dispensa in un tocco: indietro se si arriva da lì, altrimenti apre la scheda. */
export function backToPantry(nav: Nav): void {
  if (nav.canGoBack()) nav.back();
  else nav.navigate(PANTRY_HREF);
}
