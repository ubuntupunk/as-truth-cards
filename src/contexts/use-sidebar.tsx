// src/contexts/sidebar/use-sidebar.ts
import * as React from 'react'
import { SidebarContextValue } from '@/types/sidebar'
import { SidebarContext } from './sidebar-context'

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.')
  }
  return context
}
