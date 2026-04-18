import type { ChangeEvent } from 'react'
import { useMemo } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { localizePath } from '@/app/locale/locale-routing'
import { useActiveLocale } from '@/app/locale/use-active-locale'
import { useUiPreferencesStore } from '@/app/locale/ui-preferences-store'
import { useTheme } from '@/components/use-theme'
import { isUiLanguage, isUiTheme, type UiUnits } from '@/config/ui-preferences'
import { getLocalTimezoneLabel, UI_LANGUAGES } from '@/features/settings/lib/ui-preferences'
import { FormRow } from '@/layouts'
import { cn } from '@/lib/utils'

type ThemeOption = {
  key: 'system' | 'light' | 'dark'
  labelKey: string
}

type UnitsOption = {
  key: UiUnits
  labelKey: string
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    key: 'system',
    labelKey: 'settings.general.fields.appearance.system',
  },
  {
    key: 'light',
    labelKey: 'settings.general.fields.appearance.light',
  },
  {
    key: 'dark',
    labelKey: 'settings.general.fields.appearance.dark',
  },
]

const UNITS_OPTIONS: UnitsOption[] = [
  {
    key: 'metric',
    labelKey: 'settings.general.fields.units.metric',
  },
  {
    key: 'imperial',
    labelKey: 'settings.general.fields.units.imperial',
  },
]

export function GeneralTab() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const activeLocale = useActiveLocale()
  const { theme = 'system', setTheme } = useTheme()
  const language = useUiPreferencesStore((state) => state.preferences.language)
  const units = useUiPreferencesStore((state) => state.preferences.units)
  const persistLanguage = useUiPreferencesStore((state) => state.setLanguage)
  const persistUnits = useUiPreferencesStore((state) => state.setUnits)
  const timezoneLabel = useMemo(() => getLocalTimezoneLabel(), [])
  const selectedTheme =
    theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system'
  const selectedLanguage = activeLocale ?? language

  function handleLanguageChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLanguage = event.target.value

    if (!isUiLanguage(nextLanguage)) {
      return
    }

    void persistLanguage(nextLanguage, true)
    void i18n.changeLanguage(nextLanguage)
    void navigate({
      to: localizePath(pathname, nextLanguage),
      replace: true,
      search: true,
      hash: true,
    })
  }

  function handleThemeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextTheme = event.target.value

    if (!isUiTheme(nextTheme)) {
      return
    }

    setTheme(nextTheme)
  }

  function handleUnitsChange(nextUnits: UiUnits) {
    void persistUnits(nextUnits)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.general.sections.interface.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t('settings.general.fields.language.label')}
            description={t('settings.general.fields.language.description')}
            htmlFor="settings-general-language"
            align="center"
          >
            <select
              id="settings-general-language"
              value={selectedLanguage}
              onChange={handleLanguageChange}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] sm:max-w-44"
            >
              {UI_LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {t(`options.language.${language}`)}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow
            label={t('settings.general.fields.appearance.label')}
            description={t('settings.general.fields.appearance.description')}
            htmlFor="settings-general-theme"
            align="center"
          >
            <select
              id="settings-general-theme"
              value={selectedTheme}
              onChange={handleThemeChange}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] sm:max-w-44"
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.general.sections.regional.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t('settings.general.fields.timezone.label')}
            description={t('settings.general.fields.timezone.description')}
            align="center"
          >
            <div className="bg-surface-container-high text-foreground inline-flex min-h-10 items-center rounded-md px-3 font-mono text-sm">
              {timezoneLabel}
            </div>
          </FormRow>

          <FormRow
            label={t('settings.general.fields.units.label')}
            description={t('settings.general.fields.units.description')}
            align="center"
          >
            {/* Keep this preference persisted for future formatters. */}
            {/* Wire size and speed displays before treating this setting as active. */}
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">{t('settings.general.fields.units.label')}</legend>
              {UNITS_OPTIONS.map((option) => {
                const id = `settings-general-units-${option.key}`

                return (
                  <label key={option.key} htmlFor={id} className="flex items-center gap-2 text-sm">
                    <input
                      id={id}
                      type="radio"
                      name="settings-general-units"
                      value={option.key}
                      checked={units === option.key}
                      onChange={() => handleUnitsChange(option.key)}
                      className="accent-primary size-4"
                    />
                    <span
                      className={cn(
                        units === option.key ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {t(option.labelKey)}
                    </span>
                  </label>
                )
              })}
            </fieldset>
          </FormRow>
        </div>
      </section>

      <section className="border-t pt-3">
        <p className="text-foreground text-sm font-medium">
          {t('settings.general.localOnly.title')}
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-6">
          {t('settings.general.localOnly.description')}
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-6">
          {t('settings.general.localOnly.detail')}
        </p>
      </section>
    </div>
  )
}
