import * as React from 'react'
import type { SidebarContextValue } from '@/types/sidebar'

export const SidebarContext = React.createContext<SidebarContextValue | null>(null)
