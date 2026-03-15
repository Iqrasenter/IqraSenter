'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

/* ------------------------------------------------------------------ */
/*  Scroll Context                                                     */
/*  • activeSection  — which snap section (0-5) is in view            */
/*  • isScrolling    — true while the snap container is moving        */
/*                                                                     */
/*  isScrolling is stored outside React state to avoid re-rendering   */
/*  the page component (and snap container) on every scroll event.    */
/*  Only the Navbar subscribes via useSyncExternalStore.              */
/* ------------------------------------------------------------------ */

type ScrollContextType = {
  activeSection: number
  setActiveSection: (index: number) => void
  /** Subscribe to isScrolling without causing page re-renders */
  subscribeScrolling: (cb: () => void) => () => void
  getIsScrolling: () => boolean
  setIsScrolling: (v: boolean) => void
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined)

export function ScrollProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState(0)

  // isScrolling lives in a ref + external subscribers (no React state)
  const isScrollingRef = useRef(false)
  const listenersRef = useRef(new Set<() => void>())

  const subscribeScrolling = useCallback((cb: () => void) => {
    listenersRef.current.add(cb)
    return () => { listenersRef.current.delete(cb) }
  }, [])

  const getIsScrolling = useCallback(() => isScrollingRef.current, [])

  const setIsScrolling = useCallback((v: boolean) => {
    if (isScrollingRef.current !== v) {
      isScrollingRef.current = v
      listenersRef.current.forEach(cb => cb())
    }
  }, [])

  const value = useMemo<ScrollContextType>(
    () => ({
      activeSection,
      setActiveSection,
      subscribeScrolling,
      getIsScrolling,
      setIsScrolling,
    }),
    [activeSection, setActiveSection, subscribeScrolling, getIsScrolling, setIsScrolling],
  )

  return (
    <ScrollContext.Provider value={value}>
      {children}
    </ScrollContext.Provider>
  )
}

/** Used by the page component — only writes, never reads isScrolling */
export function useScrollWriter() {
  const ctx = useContext(ScrollContext)
  if (!ctx) throw new Error('useScrollWriter must be used within ScrollProvider')
  return { setActiveSection: ctx.setActiveSection, setIsScrolling: ctx.setIsScrolling }
}

/** Used by the Navbar — reads activeSection + isScrolling */
export function useScrollReader() {
  const ctx = useContext(ScrollContext)
  if (!ctx) throw new Error('useScrollReader must be used within ScrollProvider')

  const isScrolling = useSyncExternalStore(
    ctx.subscribeScrolling,
    ctx.getIsScrolling,
    ctx.getIsScrolling, // server snapshot
  )

  return { activeSection: ctx.activeSection, isScrolling }
}
