'use client'

import { useEffect, useRef, useState } from 'react'

interface ScrollDotsProps {
  sectionIds: string[]
  containerRef: React.RefObject<HTMLDivElement | null>
  onNavigate?: (index: number) => void
  onActiveChange?: (index: number) => void
}

export default function ScrollDots({ sectionIds, containerRef, onNavigate, onActiveChange }: ScrollDotsProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  // Use ref to avoid resubscribing the observer when callback changes
  const onActiveChangeRef = useRef(onActiveChange)
  onActiveChangeRef.current = onActiveChange

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const sections = sectionIds
      .map(id => document.getElementById(id))
      .filter(Boolean) as HTMLElement[]

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = sections.indexOf(entry.target as HTMLElement)
            if (index !== -1) {
              setActiveIndex(index)
              onActiveChangeRef.current?.(index)
            }
          }
        })
      },
      { root: container, threshold: 0.5 }
    )

    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [sectionIds, containerRef])

  const scrollTo = (index: number) => {
    if (onNavigate) {
      onNavigate(index)
    } else {
      const section = document.getElementById(sectionIds[index])
      section?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="fixed right-5 top-1/2 -translate-y-1/2 z-50 md:flex flex-col gap-3 hidden">
      {sectionIds.map((id, i) => (
        <button
          key={id}
          onClick={() => scrollTo(i)}
          aria-label={`Gå til seksjon ${i + 1}`}
          className="transition-all duration-300 rounded-full border-2 block"
          style={{
            width: activeIndex === i ? 10 : 7,
            height: activeIndex === i ? 10 : 7,
            backgroundColor: activeIndex === i ? '#D97706' : 'transparent',
            borderColor: '#D97706',
            opacity: activeIndex === i ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  )
}
