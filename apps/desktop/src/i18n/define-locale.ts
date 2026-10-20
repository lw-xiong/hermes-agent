import { mergeTranslations, type TranslationOverride } from '@ciel/shared/i18n'

import { en } from './en'
import type { Translations } from './types'

export type TranslationOverrides = TranslationOverride<Translations>

export const defineLocale = (overrides: TranslationOverrides): Translations =>
  mergeTranslations<Translations>(en, overrides)
