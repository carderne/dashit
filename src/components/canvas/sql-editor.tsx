import { autocompletion } from '@codemirror/autocomplete'
import { sql } from '@codemirror/lang-sql'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import CodeMirror from '@uiw/react-codemirror'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import './sql-editor.css'

interface SQLEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  readOnly?: boolean
}

function SQLEditorComponent({ value, onChange, placeholder, readOnly = false }: SQLEditorProps) {
  const [fontSize, setFontSize] = useState(14)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)

  // Check for overflow and adjust font size
  useEffect(() => {
    const checkOverflow = () => {
      if (!containerRef.current) return

      const editorElement = containerRef.current.querySelector('.cm-editor') as HTMLElement

      const containerHeight = containerRef.current.clientHeight
      const contentHeight = editorElement.scrollHeight

      // If content overflows, reduce font size
      if (contentHeight > containerHeight && fontSize > 10) {
        setFontSize((prev) => Math.max(10, prev - 1))
      }
      // If content has plenty of room and font is small, increase it
      else if (contentHeight < containerHeight * 0.7 && fontSize < 14) {
        setFontSize((prev) => Math.min(14, prev + 1))
      }
    }

    // Check overflow when content changes
    const timer = setTimeout(checkOverflow, 100)
    return () => clearTimeout(timer)
  }, [value, fontSize])

  const onCreateEditor = useCallback((view: EditorView) => {
    editorViewRef.current = view
  }, [])

  // Custom syntax highlighting - works in both light and dark mode
  const lightHighlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#0369a1', fontWeight: '600' }, // Blue-700
    { tag: tags.string, color: '#15803d' }, // Green-700
    { tag: tags.number, color: '#c2410c' }, // Orange-700
    { tag: tags.comment, color: '#64748b', fontStyle: 'italic' }, // Slate-500
    { tag: tags.operator, color: '#4b5563' }, // Gray-600
    { tag: tags.variableName, color: '#1e293b' }, // Slate-800
    { tag: tags.propertyName, color: '#1e293b' }, // Slate-800
    { tag: tags.typeName, color: '#7c3aed' }, // Violet-600
  ])

  const darkHighlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#60a5fa', fontWeight: '600' }, // Blue-400
    { tag: tags.string, color: '#4ade80' }, // Green-400
    { tag: tags.number, color: '#fb923c' }, // Orange-400
    { tag: tags.comment, color: '#94a3b8', fontStyle: 'italic' }, // Slate-400
    { tag: tags.operator, color: '#cbd5e1' }, // Slate-300
    { tag: tags.variableName, color: '#e2e8f0' }, // Slate-200
    { tag: tags.propertyName, color: '#e2e8f0' }, // Slate-200
    { tag: tags.typeName, color: '#c084fc' }, // Purple-400
  ])

  // Detect if we're in dark mode
  const isDarkMode =
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')

  // Custom theme overrides (font, cursor, etc)
  const customTheme = EditorView.theme({
    '&': {
      height: '100%',
      fontSize: `${fontSize}px`,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      cursor: 'text',
    },
    '.cm-content': {
      fontSize: `${fontSize}px`,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      minHeight: '100%',
      cursor: 'text',
      borderRadius: '100px',
    },
    '.cm-scroller': {
      overflow: 'auto',
      cursor: 'text',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    },
    '.cm-placeholder': {
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    },
    '.cm-focused': {
      outline: 'none',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-gutters': {
      display: 'none',
    },
  })

  return (
    <div
      ref={containerRef}
      className="sql-editor-container nodrag nowheel h-full cursor-text overflow-auto p-2"
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[
          sql(),
          EditorView.lineWrapping,
          customTheme,
          syntaxHighlighting(isDarkMode ? darkHighlighting : lightHighlighting),
          // Disable aggressive autocomplete - only trigger on Ctrl+Space
          autocompletion({
            activateOnTyping: false,
            override: [],
          }),
        ]}
        placeholder={placeholder}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: false,
          highlightActiveLineGutter: false,
          highlightSpecialChars: false,
          foldGutter: false,
          drawSelection: true,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          rectangularSelection: false,
          crosshairCursor: false,
          highlightActiveLine: false,
          highlightSelectionMatches: false,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: false,
          historyKeymap: true,
          foldKeymap: false,
          completionKeymap: false,
          lintKeymap: false,
        }}
        className="h-full cursor-text"
        style={{
          height: '100%',
          cursor: 'text',
          borderRadius: '100px',
        }}
        onCreateEditor={onCreateEditor}
      />
    </div>
  )
}

export const SQLEditor = memo(SQLEditorComponent)
