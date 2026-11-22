/**
 * The one global Atmospheric / Editorial / Workspace treatment.
 *
 * Before bd `as-truth-cards-e4k` the choice was copied into the header, deck,
 * graph hook, account pages and onboarding wizard, and each page mounted its own
 * `data-treatment` zone. Selectors could disagree with the chrome on screen, and
 * routes without a zone fell back to the `:root` defaults. This provider is the
 * single authority: every selector reads and writes {@link useTreatment}, and
 * exactly one wrapper carries the tokens so every route paints the same chrome.
 *
 * The choice is presentation-only. It repaints `--graph-*` surfaces and the
 * workspace font, and it never touches the light/dark {@link ThemeProvider}, the
 * graph projection, focus, view, depth or selection. Per-treatment dark palettes
 * remain distinct: the wrapper carries both `-light` and `-dark` pairs and
 * `index.css` selects the right one from the `.dark` class on `<html>`.
 */

import { type ComponentChildren, createContext } from 'preact'
import { useCallback, useContext, useEffect, useState } from 'preact/hooks'
import {
  GRAPH_TREATMENT_STORAGE_KEY,
  type GraphTreatment,
  graphTreatmentVars,
  readGraphTreatment,
  writeGraphTreatment,
} from '@/graph/appearance'
import { deviceStorage } from '@/lib/device-storage'

/** The shared treatment value and the one write path to device storage. */
export interface TreatmentContextValue {
  /** The treatment applied by the global wrapper. */
  treatment: GraphTreatment
  /** Apply a treatment everywhere and remember it on this device. */
  setTreatment: (treatment: GraphTreatment) => void
}

/**
 * Value seen when a component is rendered without a provider.
 *
 * Isolated render tests mount selectors on their own; they get the neutral
 * default and a harmless setter. The routed app always has {@link TreatmentProvider}
 * mounted above the router, so this is never the live app's authority.
 */
const UNMOUNTED_TREATMENT: TreatmentContextValue = {
  treatment: 'atmospheric',
  setTreatment: () => undefined,
}

/** The single treatment authority shared by every surface. */
export const TreatmentContext =
  createContext<TreatmentContextValue>(UNMOUNTED_TREATMENT)

/** Props for {@link TreatmentProvider}. */
export interface TreatmentProviderProps {
  /** The routed app (or any subtree that uses {@link useTreatment}). */
  children: ComponentChildren
  /**
   * Explicit starting value; when omitted the stored choice (or the atmospheric
   * default) is read from guarded device storage.
   */
  initialTreatment?: GraphTreatment
}

/**
 * Mount the one treatment zone and publish the shared choice to every route.
 *
 * The initial value is an explicit `initialTreatment` when supplied (tests and
 * pre-paint callers), otherwise the validated stored choice. {@link setTreatment}
 * writes storage *at the call site* — never in an effect on `treatment` — so a
 * cross-tab `storage` event cannot echo a write back into another write loop.
 * One listener, installed once, keeps other tabs in sync and ignores unrelated
 * storage keys.
 *
 * @param props The provider props.
 * @param props.children The subtree painted inside the treatment wrapper.
 * @param props.initialTreatment Optional starting treatment.
 * @returns A context provider wrapping one `data-treatment` element.
 * @example
 * ```tsx
 * <TreatmentProvider>
 *   <BrowserRouter>{routes}</BrowserRouter>
 * </TreatmentProvider>
 * ```
 */
export function TreatmentProvider({
  children,
  initialTreatment,
}: TreatmentProviderProps) {
  const [treatment, setTreatmentState] = useState<GraphTreatment>(
    () => initialTreatment ?? readGraphTreatment(deviceStorage()),
  )

  // One listener for the life of the provider. Reading storage *after* the event
  // (rather than trusting `event.newValue`) keeps the validation in one place.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const onStorage = (event: StorageEvent) => {
      if (event.key !== GRAPH_TREATMENT_STORAGE_KEY) return
      setTreatmentState(readGraphTreatment(deviceStorage()))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setTreatment = useCallback((next: GraphTreatment) => {
    writeGraphTreatment(next, deviceStorage())
    setTreatmentState(next)
  }, [])

  return (
    <TreatmentContext.Provider value={{ treatment, setTreatment }}>
      <div
        className="min-h-screen"
        data-treatment={treatment}
        style={graphTreatmentVars(treatment)}
      >
        {children}
      </div>
    </TreatmentContext.Provider>
  )
}

/**
 * Read the shared treatment choice and its setter.
 *
 * @returns The {@link TreatmentContextValue} published by {@link TreatmentProvider}.
 * @example
 * ```tsx
 * const { treatment, setTreatment } = useTreatment()
 * ```
 */
export function useTreatment(): TreatmentContextValue {
  return useContext(TreatmentContext)
}
