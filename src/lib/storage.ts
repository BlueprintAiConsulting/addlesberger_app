import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage'
import { storage, COMPANY_ID } from '@/firebase'

async function compressAndConvertToDataUrl(file: File): Promise<string> {
  const MAX_DIMENSION = 1024
  const JPEG_QUALITY = 0.7

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        try {
          let { naturalWidth: w, naturalHeight: h } = img
          if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
            const scale = MAX_DIMENSION / Math.max(w, h)
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(reader.result as string)
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
          resolve(dataUrl)
        } catch (err) {
          resolve(reader.result as string)
        }
      }
      img.onerror = () => reject(new Error('Failed to load image for compression'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function uploadPhoto(file: File): Promise<{ url: string; fileName: string }> {
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')

  try {
    const path = `companies/${COMPANY_ID}/photos/${timestamp}_${safeName}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    return { url, fileName: safeName }
  } catch (storageErr: any) {
    console.warn('Firebase Storage upload failed, falling back to base64 storage:', storageErr.message || storageErr)
    try {
      const dataUrl = await compressAndConvertToDataUrl(file)
      return { url: dataUrl, fileName: safeName }
    } catch (compressErr: any) {
      throw new Error(`Failed to process photo: ${compressErr.message || compressErr}`)
    }
  }
}

export async function deletePhoto(fileName: string): Promise<void> {
  try {
    const folderRef = ref(storage, `companies/${COMPANY_ID}/photos`)
    const list = await listAll(folderRef)
    const match = list.items.find(item => item.name.endsWith(`_${fileName}`) || item.name === fileName)
    if (match) {
      await deleteObject(match)
    }
  } catch (err) {
    console.warn('Delete from storage failed (already deleted or unconfigured):', err)
  }
}
