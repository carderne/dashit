import { Button } from '@/components/ui/button'
import { CheckIcon, LinkIcon } from 'lucide-react'
import { useState } from 'react'

export function CopyDisplay({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="default" onClick={handleCopy} title={copied ? 'Copied!' : 'Copy Key'}>
      {copied ? (
        <>
          <CheckIcon size={16} />
          <span>Copied</span>
        </>
      ) : (
        <>
          <LinkIcon size={16} />
          <span>{label}</span>
        </>
      )}
    </Button>
  )
}
