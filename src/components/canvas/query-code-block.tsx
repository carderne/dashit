import type { NodeViewProps } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'

export function QueryCodeBlock(_props: NodeViewProps) {
  return (
    <NodeViewWrapper className="code-block">
      <pre>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <NodeViewContent as={'code' as any} />
      </pre>
    </NodeViewWrapper>
  )
}
