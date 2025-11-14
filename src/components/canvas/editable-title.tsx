import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoxUpdate } from '../../types/box'
import { Input } from '../ui/input'

interface EditableTitleProps {
  boxId: Id<'boxes'>
  dashboardId: Id<'dashboards'>
  title: string | undefined
  defaultTitle: string
  sessionId?: string
  shareKey?: string
  onUpdate: (boxId: Id<'boxes'>, updates: BoxUpdate) => void
}

// SQL identifier validation
const isValidSQLIdentifier = (name: string): string | undefined => {
  if (!name || !name.trim()) {
    return undefined // Empty is okay - will use default title
  }

  const trimmed = name.trim()

  if (trimmed.length > 50) {
    return 'Name cannot exceed 50 characters'
  }

  // Must start with letter or underscore
  if (!/^[a-zA-Z_]/.test(trimmed)) {
    return 'Name must start with a letter or underscore'
  }

  // Must contain only alphanumeric and underscores
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return 'Name can only contain letters, numbers, and underscores'
  }

  return undefined
}

export function EditableTitle({
  boxId,
  dashboardId,
  title,
  defaultTitle,
  sessionId,
  shareKey,
  onUpdate,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [validationError, setValidationError] = useState<string | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)

  const displayTitle = title || defaultTitle

  // Query for validation (only enabled when we have a draft name)
  const shouldValidate = draftName.trim() !== '' && draftName.trim() !== title
  const { data: validationResult, isFetching: isValidating } = useQuery({
    ...convexQuery(api.boxes.validateUniqueName, {
      dashboardId,
      name: draftName.trim(),
      excludeBoxId: boxId,
      sessionId,
      key: shareKey,
    }),
    enabled: shouldValidate,
  })

  // Update validation error when result changes
  useEffect(() => {
    if (!shouldValidate) {
      setValidationError(undefined)
      return
    }

    if (validationResult && !validationResult.isValid) {
      if (validationResult.conflictsWith === 'box') {
        setValidationError('Name already used by another query, table, or chart')
      } else if (validationResult.conflictsWith === 'dataset') {
        setValidationError('Name already used by a dataset')
      } else {
        setValidationError('Name is not available')
      }
    } else {
      setValidationError(undefined)
    }
  }, [validationResult, shouldValidate])

  // Create form with validation
  const form = useForm({
    defaultValues: {
      title: title || '',
    },
    onSubmit: ({ value }) => {
      const trimmed = value.title.trim()

      // Check SQL identifier validation
      const sqlError = isValidSQLIdentifier(trimmed)
      if (sqlError) {
        setValidationError(sqlError)
        return
      }

      // Check uniqueness validation
      if (validationError) {
        return
      }

      // Empty string means use default title (no custom title)
      const newTitle = trimmed || undefined

      // Only update if changed
      if (newTitle !== title) {
        onUpdate(boxId, { title: newTitle })
      }

      setIsEditing(false)
      setDraftName('')
      setValidationError(undefined)
    },
  })

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Handle click to enter edit mode
  const handleClick = useCallback(() => {
    form.setFieldValue('title', title || '')
    setDraftName(title || '')
    setValidationError(undefined)
    setIsEditing(true)
  }, [form, title])

  // Handle cancel (ESC key)
  const handleCancel = useCallback(() => {
    form.reset()
    setIsEditing(false)
    setDraftName('')
    setValidationError(undefined)
  }, [form])

  if (!isEditing) {
    return (
      <button
        onClick={handleClick}
        className="cursor-pointer text-sm font-medium transition-colors hover:text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none"
        title="Click to rename"
      >
        {displayTitle}
      </button>
    )
  }

  // Calculate combined error (SQL validation or uniqueness)
  const sqlError = isValidSQLIdentifier(draftName)
  const displayError = sqlError || validationError

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          handleCancel()
        }
        e.stopPropagation()
      }}
      className="flex-1"
    >
      <form.Field name="title">
        {(field) => (
          <div className="relative">
            <Input
              ref={inputRef}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value)
                setDraftName(e.target.value)
              }}
              onBlur={() => {
                // Submit on blur if no errors
                if (!displayError && !isValidating) {
                  form.handleSubmit()
                } else if (displayError) {
                  handleCancel()
                }
              }}
              placeholder={defaultTitle}
              maxLength={50}
              className="nodrag h-7 text-sm"
              autoComplete="off"
            />
            {displayError && (
              <p className="absolute top-full left-0 z-10 mt-1 rounded bg-red-500 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg">
                {displayError}
              </p>
            )}
            {isValidating && !displayError && (
              <p className="absolute top-full left-0 z-10 mt-1 rounded bg-blue-500 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg">
                Checking...
              </p>
            )}
          </div>
        )}
      </form.Field>
    </form>
  )
}
