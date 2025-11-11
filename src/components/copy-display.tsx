import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/button'

export function CopyDisplay({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative rounded-lg border border-blue-200 bg-blue-100 p-6">
      <div className="pr-16 font-mono text-sm leading-relaxed break-all text-gray-800">{value}</div>
      <Button
        variant="outline"
        className="absolute right-0 bottom-0 m-2"
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy Key'}
      >
        {copied ? (
          <>
            <CheckIcon size={16} className="text-green-600" />
            <span className="text-green-600">Copied</span>
          </>
        ) : (
          <>
            <CopyIcon size={16} />
            <span>{label}</span>
          </>
        )}
      </Button>
    </div>
  )
}
