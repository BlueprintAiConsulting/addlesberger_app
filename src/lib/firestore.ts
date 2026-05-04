import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  DocumentData,
} from 'firebase/firestore'
import { db, COMPANY_ID } from '@/firebase'

function companyCol(subcollection: string) {
  return collection(db, 'companies', COMPANY_ID, subcollection)
}

function companyDoc(subcollection: string, docId: string) {
  return doc(db, 'companies', COMPANY_ID, subcollection, docId)
}

export async function addItem(subcollection: string, data: DocumentData) {
  return addDoc(companyCol(subcollection), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateItem(subcollection: string, docId: string, data: DocumentData) {
  return updateDoc(companyDoc(subcollection, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function archiveItem(subcollection: string, docId: string) {
  return updateDoc(companyDoc(subcollection, docId), {
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function unarchiveItem(subcollection: string, docId: string) {
  return updateDoc(companyDoc(subcollection, docId), {
    archivedAt: null,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteItem(subcollection: string, docId: string) {
  return deleteDoc(companyDoc(subcollection, docId))
}
