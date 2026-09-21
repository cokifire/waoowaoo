'use client'

import { useState } from 'react'
import type { ProviderCardProps, ProviderCardTranslator } from './types'
import type { UseProviderCardStateResult } from './hooks/useProviderCardState'
import { useToast } from '@/contexts/ToastContext'
import { AppIcon } from '@/components/ui/icons'

interface ProviderBaseFieldsProps {
  provider: ProviderCardProps['provider']
  t: ProviderCardTranslator
  state: UseProviderCardStateResult
  onUpdateBaseUrl?: ProviderCardProps['onUpdateBaseUrl']
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** Bring-your-own-endpoint providers (no preset URL) edit their Base URL here. */
function ProviderBaseUrlField({
  provider,
  t,
  onUpdateBaseUrl,
}: {
  provider: ProviderCardProps['provider']
  t: ProviderCardTranslator
  onUpdateBaseUrl?: ProviderCardProps['onUpdateBaseUrl']
}) {
  const { showToast } = useToast()
  const [value, setValue] = useState(provider.baseUrl ?? '')
  const [syncedUrl, setSyncedUrl] = useState(provider.baseUrl ?? '')

  // Re-sync the draft when the saved URL changes externally; adjusting state
  // during render avoids the cascading render of a setState-in-effect.
  if (syncedUrl !== (provider.baseUrl ?? '')) {
    setSyncedUrl(provider.baseUrl ?? '')
    setValue(provider.baseUrl ?? '')
  }

  const commit = () => {
    if (!onUpdateBaseUrl) return
    const next = value.trim()
    if (next === (provider.baseUrl ?? '')) return
    if (next && !isValidHttpUrl(next)) {
      showToast(t('baseUrlInvalid'), 'warning')
      setValue(provider.baseUrl ?? '')
      return
    }
    onUpdateBaseUrl(provider.id, next)
  }

  return (
    <div className="glass-surface-soft mt-2 flex items-center gap-3 rounded-xl px-3 py-2">
      <span className="shrink-0 text-xs font-medium text-[var(--glass-text-secondary)]">
        {t('baseUrlLabel')}
      </span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
        }}
        placeholder={t('baseUrlPlaceholder')}
        aria-label={t('baseUrlLabel')}
        className="glass-input-base min-w-0 flex-1 px-3 py-1.5 font-mono text-xs"
      />
    </div>
  )
}

export function ProviderBaseFields({ provider, t, state, onUpdateBaseUrl }: ProviderBaseFieldsProps) {
  return (
    <div className="px-4 pt-3">
      <div className="glass-surface-soft flex items-center gap-3 rounded-xl px-3 py-2">
        <span className="shrink-0 text-xs font-medium text-[var(--glass-text-secondary)]">
          {t('apiKeyLabel')}
        </span>
        {state.isEditing ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(event) => { event.preventDefault(); state.handleSaveKey() }}
          >
            <input
              type="password"
              autoComplete="off"
              value={state.tempKey}
              onChange={(event) => state.setTempKey(event.target.value)}
              placeholder={t('enterApiKey')}
              aria-label={t('apiKeyLabel')}
              className="glass-input-base min-w-0 flex-1 px-3 py-1.5 text-xs"
              autoFocus
            />
            <button type="submit" className="glass-icon-btn-sm" aria-label={t('save')}>
              <AppIcon name="check" className="h-4 w-4" />
            </button>
            <button type="button" onClick={state.handleCancelEdit} className="glass-icon-btn-sm" aria-label={t('cancel')}>
              <AppIcon name="close" className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="text-xs text-[var(--glass-text-tertiary)]">
              {provider.hasApiKey ? t('keyConfigured') : t('notConfigured')}
            </span>
            <button type="button" onClick={state.startEditKey} className="glass-btn-base glass-btn-soft px-2.5 py-1.5 text-xs">
              <AppIcon name={provider.hasApiKey ? 'edit' : 'plus'} className="h-3.5 w-3.5" />
              {provider.hasApiKey ? t('configure') : t('configureApiKey')}
            </button>
          </div>
        )}
      </div>
      {provider.supportsCustomBaseUrl && (
        <ProviderBaseUrlField provider={provider} t={t} onUpdateBaseUrl={onUpdateBaseUrl} />
      )}
    </div>
  )
}
