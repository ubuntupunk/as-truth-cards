"use client"

import { useEffect, useState } from 'react'

// Delayed visibility hook for staggered animations
export const useDelayedVisibility = (delay: number = 0) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  return isVisible
}

// Animation classes utility
export const getTransitionClasses = (options: {
  visible: boolean
  enterClasses?: string
  exitClasses?: string
  baseClasses?: string
}) => {
  const {
    visible,
    enterClasses = 'opacity-100',
    exitClasses = 'opacity-0',
    baseClasses = '',
  } = options

  return `${baseClasses} transition-all duration-500 ease-out ${visible ? enterClasses : exitClasses}`
}

// Staggered children animation utility
export const getStaggeredChildren = (numChildren: number, baseDelay: number = 100) => {
  return Array.from({ length: numChildren }, (_, i) => baseDelay * i)
}
