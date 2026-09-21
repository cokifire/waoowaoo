'use client'

import { useState, useMemo } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import {
  encodeModelKey,
  getProviderTutorial,
  matchesModelKey,
} from '../../types'
import type {
  ModelFormState,
  ProviderCardGroupedModels,
  ProviderCardModelType,
  ProviderCardProps,
  ProviderCardTranslator,
} from '../types'
import type { CustomModel } from '../../types'
import { useToast } from '@/contexts/ToastContext'

interface UseProviderCardStateParams {
  provider: ProviderCardProps['provider']
  models: ProviderCardProps['models']
  allModels?: ProviderCardProps['allModels']
  defaultModels: ProviderCardProps['defaultModels']
  onUpdateApiKey: ProviderCardProps['onUpdateApiKey']
  onUpdateModel: ProviderCardProps['onUpdateModel']
  onAddModel: ProviderCardProps['onAddModel']
  t: ProviderCardTranslator
}

const EMPTY_MODEL_FORM: ModelFormState = {
  name: '',
  modelId: '',
}

/** Server discovery failure codes mapped to user-facing messages. */
const MODEL_DISCOVERY_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  PROVIDER_BASE_URL_MISSING: 'detectModelsMissingBaseUrl',
  PROVIDER_BASE_URL_INVALID: 'detectModelsMissingBaseUrl',
  PROVIDER_API_KEY_MISSING: 'detectModelsMissingApiKey',
  PROVIDER_AUTH_INVALID: 'detectModelsMissingApiKey',
  MODEL_DISCOVERY_AUTH_INVALID: 'detectModelsMissingApiKey',
  MODEL_DISCOVERY_UNSUPPORTED: 'detectModelsUnsupported',
  MODEL_DISCOVERY_EMPTY: 'detectModelsEmpty',
  MODEL_DISCOVERY_UNREACHABLE: 'detectModelsFailed',
}

async function readApiFailureCode(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') return ''
    const record = payload as Record<string, unknown>
    const error = record.error && typeof record.error === 'object'
      ? record.error as Record<string, unknown>
      : null
    const details = error?.details && typeof error.details === 'object'
      ? error.details as Record<string, unknown>
      : null
    for (const candidate of [details?.code, error?.code, record.code]) {
      if (typeof candidate === 'string' && candidate) return candidate
    }
    return ''
  } catch {
    return ''
  }
}

export function buildProviderCardGroupedModels(
  models: CustomModel[],
): ProviderCardGroupedModels {
  const groupedModels: ProviderCardGroupedModels = {}
  for (const model of models) {
    const groupedType = model.type
    if (!groupedModels[groupedType]) {
      groupedModels[groupedType] = []
    }
    groupedModels[groupedType]!.push(model)
  }
  return groupedModels
}

export interface UseProviderCardStateResult {
  isPresetProvider: boolean
  tutorial: ReturnType<typeof getProviderTutorial>
  groupedModels: ProviderCardGroupedModels
  isEditing: boolean
  tempKey: string
  showTutorial: boolean
  showAddForm: ProviderCardModelType | null
  newModel: ModelFormState
  editingModelId: string | null
  editModel: ModelFormState
  isPresetModel: (modelKey: string) => boolean
  isDefaultModel: (model: CustomModel) => boolean
  setShowTutorial: (value: boolean) => void
  setShowAddForm: (value: ProviderCardModelType | null) => void
  setNewModel: (value: ModelFormState) => void
  setEditModel: (value: ModelFormState) => void
  setTempKey: (value: string) => void
  startEditKey: () => void
  handleSaveKey: () => void
  handleCancelEdit: () => void
  handleEditModel: (model: CustomModel) => void
  handleCancelEditModel: () => void
  handleSaveModel: (originalModelKey: string) => Promise<void>
  handleAddModel: (type: ProviderCardModelType) => Promise<void>
  handleCancelAdd: () => void
  isModelSavePending: boolean
  discoveredModels: string[]
  isDiscoveringModels: boolean
  handleDiscoverModels: () => Promise<void>
  pickDiscoveredModel: (modelId: string) => void
}

export function useProviderCardState({
  provider,
  models,
  allModels,
  defaultModels,
  onUpdateApiKey,
  onUpdateModel,
  onAddModel,
  t,
}: UseProviderCardStateParams): UseProviderCardStateResult {
  const { showToast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [tempKey, setTempKey] = useState(provider.apiKey || '')
  const [showTutorial, setShowTutorial] = useState(false)
  const [showAddForm, setShowAddForm] = useState<ProviderCardModelType | null>(null)
  const [newModel, setNewModel] = useState<ModelFormState>(EMPTY_MODEL_FORM)
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [editModel, setEditModel] = useState<ModelFormState>(EMPTY_MODEL_FORM)
  const [isModelSavePending, setIsModelSavePending] = useState(false)
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([])
  const [isDiscoveringModels, setIsDiscoveringModels] = useState(false)

  const isPresetProvider = !provider.id.includes(':')
  const tutorial = getProviderTutorial(provider.id)

  const groupedModels = useMemo(
    () => buildProviderCardGroupedModels(models),
    [models],
  )

  const isPresetModel = () => false

  const isDefaultModel = (model: CustomModel) => (
    model.type === 'llm'
      ? matchesModelKey(defaultModels.assistantModel, model.provider, model.modelId)
      : model.enabled
  )

  const startEditKey = () => {
    setTempKey('')
    setIsEditing(true)
  }

  const handleSaveKey = () => {
    if (!tempKey.trim()) {
      showToast(t('enterApiKey'), 'warning')
      return
    }
    onUpdateApiKey(provider.id, tempKey.trim())
    setTempKey('')
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setTempKey('')
    setIsEditing(false)
  }

  const handleEditModel = (model: CustomModel) => {
    setEditingModelId(model.modelKey)
    setEditModel({
      name: model.name,
      modelId: model.modelId,
    })
  }

  const handleCancelEditModel = () => {
    setEditingModelId(null)
    setEditModel(EMPTY_MODEL_FORM)
  }

  const handleSaveModel = async (originalModelKey: string): Promise<void> => {
    if (isModelSavePending) return
    if (!editModel.name || !editModel.modelId) {
      showToast(t('fillComplete'), 'warning')
      return
    }

    const nextModelKey = encodeModelKey(provider.id, editModel.modelId)
    const all = allModels || models
    const duplicate = all.some(
      (model) =>
        model.modelKey === nextModelKey &&
        model.modelKey !== originalModelKey,
    )

    if (duplicate) {
      showToast(t('modelIdExists'), 'warning')
      return
    }

    setIsModelSavePending(true)
    try {
      onUpdateModel?.(originalModelKey, {
        name: editModel.name,
        modelId: editModel.modelId,
      })

      handleCancelEditModel()
    } finally {
      setIsModelSavePending(false)
    }
  }

  const handleAddModel = async (type: ProviderCardModelType): Promise<void> => {
    if (isModelSavePending) return
    if (!newModel.name || !newModel.modelId) {
      showToast(t('fillComplete'), 'warning')
      return
    }

    const finalModelId = newModel.modelId
    const finalModelKey = encodeModelKey(provider.id, finalModelId)

    const all = allModels || models
    if (all.some((model) => model.modelKey === finalModelKey)) {
      showToast(t('modelIdExists'), 'warning')
      return
    }

    setIsModelSavePending(true)
    try {
      onAddModel({
        modelId: finalModelId,
        modelKey: finalModelKey,
        name: newModel.name,
        type,
        provider: provider.id,
      })

      setNewModel(EMPTY_MODEL_FORM)
      setShowAddForm(null)
    } finally {
      setIsModelSavePending(false)
    }
  }

  const handleCancelAdd = () => {
    setShowAddForm(null)
    setNewModel(EMPTY_MODEL_FORM)
    setDiscoveredModels([])
  }

  /**
   * Ask the endpoint itself which models it serves, so the user never has to
   * copy model ids by hand. Credentials come from the saved provider config
   * unless the card carries a draft Base URL.
   */
  const handleDiscoverModels = async (): Promise<void> => {
    if (isDiscoveringModels) return
    setIsDiscoveringModels(true)
    try {
      const response = await apiFetch('/api/user/api-config/discover-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: provider.id,
          ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
        }),
      })
      if (!response.ok) {
        const code = await readApiFailureCode(response)
        showToast(t(MODEL_DISCOVERY_MESSAGE_KEYS[code] ?? 'detectModelsFailed'), 'warning')
        return
      }
      const payload: unknown = await response.json()
      const rawModels = payload && typeof payload === 'object'
        ? Reflect.get(payload as object, 'models')
        : null
      const models = Array.isArray(rawModels)
        ? rawModels.filter((model): model is string => typeof model === 'string' && model.trim().length > 0)
        : []
      if (models.length === 0) {
        showToast(t('detectModelsEmpty'), 'warning')
        return
      }
      setDiscoveredModels(models)
      showToast(t('detectModelsFound', { count: models.length }), 'success')
    } catch {
      showToast(t('detectModelsFailed'), 'warning')
    } finally {
      setIsDiscoveringModels(false)
    }
  }

  const pickDiscoveredModel = (modelId: string) => {
    setNewModel((previous) => ({
      name: previous.name || modelId,
      modelId,
    }))
  }

  return {
    isPresetProvider,
    tutorial,
    groupedModels,
    isEditing,
    tempKey,
    showTutorial,
    showAddForm,
    newModel,
    editingModelId,
    editModel,
    isPresetModel,
    isDefaultModel,
    setShowTutorial,
    setShowAddForm,
    setNewModel,
    setEditModel,
    setTempKey,
    startEditKey,
    handleSaveKey,
    handleCancelEdit,
    handleEditModel,
    handleCancelEditModel,
    handleSaveModel,
    handleAddModel,
    handleCancelAdd,
    isModelSavePending,
    discoveredModels,
    isDiscoveringModels,
    handleDiscoverModels,
    pickDiscoveredModel,
  }
}
