import { autocompletion } from '@codemirror/autocomplete'
import { sql } from '@codemirror/lang-sql'
import { EditorView } from '@codemirror/view'
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
      className="sql-editor-container nodrag nowheel h-full cursor-text overflow-auto"
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[
          sql(),
          EditorView.lineWrapping,
          customTheme,
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
        }}
        onCreateEditor={onCreateEditor}
      />
    </div>
  )
}

export const SQLEditor = memo(SQLEditorComponent)
