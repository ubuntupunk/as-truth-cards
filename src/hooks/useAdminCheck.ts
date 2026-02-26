'use client'

import { useUser } from '@stackframe/stack'
import { useEffect, useState } from 'react'

export const useAdminCheck = () => {
  const user = useUser()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      try {
        // Primary Method: Check user role from database
        // Note: You need to create an API endpoint at /api/auth/user-role
        // that queries the user_profiles table
        const response = await fetch('/api/auth/user-role', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const userData = await response.json()
          console.log('User role data:', userData)

          // Check if user has ADMIN role (from user_profiles table)
          if (userData.role === 'ADMIN') {
            setIsAdmin(true)
            setLoading(false)
            return
          }
        } else if (response.status !== 404) {
          // 404 means endpoint doesn't exist, fall back to email check
          console.error(
            'Failed to fetch user role:',
            response.status,
            response.statusText,
          )
        }

        // Fallback Method: Check if user email is in admin list (for development)
        const adminEmails = [
          import.meta.env.VITE_ADMIN_EMAIL,
          'admin@truthcards.com',
          'admin@localhost',
        ].filter(Boolean)

        const userEmail = user.primaryEmail?.toLowerCase()
        if (
          userEmail &&
          adminEmails.some((email) => email?.toLowerCase() === userEmail)
        ) {
          setIsAdmin(true)
          setLoading(false)
          return
        }

        setIsAdmin(false)
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdminStatus()
  }, [user?.id])

  return { isAdmin, loading, isSignedIn: !!user?.id }
}

export default useAdminCheck
