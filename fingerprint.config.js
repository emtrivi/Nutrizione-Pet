// Impronta della parte nativa (runtimeVersion "fingerprint").
// Preset "balanced" dichiarato esplicitamente, così un cambio del valore predefinito in un SDK
// futuro non cambia il comportamento senza che ce ne accorgiamo. Questo preset NON conta:
// il numero di versione (app.json "version"), eas.json, gli script di package.json.
// Il JavaScript e i file in release/ non fanno mai parte dell'impronta.

/** @type {import('expo/fingerprint').Config} */
const config = {
  preset: 'balanced',
};

module.exports = config;
