import { useState, useEffect } from 'react'
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
  QueryConstraint,
  DocumentData,
} from 'firebase/firestore'
import { db, COMPANY_ID } from '@/firebase'

export function useCollection<T extends { id: string }>(
  subcollection: string,
  constraints: QueryConstraint[] = [],
  deps: unknown[] = []
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const colRef = collection(db, 'companies', COMPANY_ID, subcollection)
    const q = query(colRef, ...constraints)

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[]
        setData(items)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error(`Firestore error on ${subcollection}:`, err)
        setError(err.message)
        setLoading(false)
      }
    )

    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subcollection, ...deps])

  return { data, loading, error }
}
