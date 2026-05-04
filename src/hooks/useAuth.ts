import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User, updateProfile } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, COMPANY_ID } from '@/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    // Update last active
    await setDoc(
      doc(db, 'companies', COMPANY_ID, 'members', cred.user.uid),
      { lastActive: serverTimestamp() },
      { merge: true }
    )
    return cred.user
  }

  const register = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    // Add to company members
    await setDoc(doc(db, 'companies', COMPANY_ID, 'members', cred.user.uid), {
      email,
      displayName,
      role: 'member',
      joinedAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    })
    return cred.user
  }

  const logout = () => signOut(auth)

  return { user, loading, login, register, logout }
}
