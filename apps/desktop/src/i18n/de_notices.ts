import type { TranslationOverrides } from './define-locale'

// Shell notices (remote-display toast, butterbar, keep-awake offer), spread into de.ts.
export const deNotices = {
  remoteDisplayBanner: {
    message: reason =>
      `Software-Rendering aktiv — Remote-Display erkannt (${reason}). GPU-Beschleunigung ist deaktiviert, um Flackern zu verhindern.`
  },
  butterbar: {
    goTo: (index, total) => `Hinweis ${index} von ${total} anzeigen`,
    legal: {
      before: 'Die Nutzung von Ciel unterliegt unseren ',
      terms: 'Nutzungsbedingungen',
      between: ' und unserer ',
      privacy: 'Datenschutzerklärung',
      after: '.'
    }
  },
  keepAwakeOffer: {
    title: 'Ihr Computer ist eingeschlafen, während Ciel gearbeitet hat',
    message:
      'Ciel kann den Computer wach halten, solange eine Aufgabe läuft. Der Bildschirm schaltet sich weiterhin aus, und im Akkubetrieb kann der Computer trotzdem einschlafen.',
    action: 'Während der Arbeit wach halten'
  }
} satisfies Pick<TranslationOverrides, 'remoteDisplayBanner' | 'butterbar' | 'keepAwakeOffer'>
