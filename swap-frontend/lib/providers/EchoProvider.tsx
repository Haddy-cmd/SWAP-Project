'use client'

import { type ReactNode } from 'react'
import { useReverb } from '@/lib/hooks/useReverb'

function EchoSubscriber() {
  useReverb()
  return null
}

export function EchoProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <EchoSubscriber />
      {children}
    </>
  )
}
