import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage'
import { storage, COMPANY_ID } from '@/firebase'

export async function uploadPhoto(file: File): Promise<{ url: string; fileName: string }> {
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `companies/${COMPANY_ID}/photos/${timestamp}_${safeName}`
  const storageRef = ref(storage, path)

  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)

  return { url, fileName: safeName }
}

export async function deletePhoto(fileName: string): Promise<void> {
  const folderRef = ref(storage, `companies/${COMPANY_ID}/photos`)
  const list = await listAll(folderRef)
  const match = list.items.find(item => item.name.endsWith(`_${fileName}`) || item.name === fileName)
  if (match) {
    await deleteObject(match)
  }
}
