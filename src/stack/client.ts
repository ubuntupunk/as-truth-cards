import { StackClientApp } from '@stackframe/stack'

type StorageType = 'cookie' | 'nextjs-cookie' | 'memory'

export const stackClientApp = new StackClientApp({
  tokenStore: 'nextjs-cookie' as StorageType, // Corrected indentation and removed trailing space
})
