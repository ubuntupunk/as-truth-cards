// src/types/sidebar.ts
import { SidebarContext as _SidebarContext } from '@/contexts/sidebar-context'

export type SidebarContextValue = {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: (open: boolean | ((value: boolean) => boolean)) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

export const SidebarContext = _SidebarContext
