import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage'
import { storage, COMPANY_ID } from '@/firebase'

async function optimizeImageToWebP(file: File): Promise<File> {
  const MAX_DIMENSION = 1920 // Reasonable max for high quality
  const WEBP_QUALITY = 0.95 // High quality near-lossless

  // Only attempt to convert images
  if (!file.type.startsWith('image/')) {
    return file
  }

  return new Promise((resolve) => {
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
            resolve(file)
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          
          canvas.toBlob((blob) => {
            if (blob) {
              const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp"
              const webpFile = new File([blob], newName, { type: 'image/webp' })
              resolve(webpFile)
            } else {
              resolve(file)
            }
          }, 'image/webp', WEBP_QUALITY)
        } catch (err) {
          resolve(file) // Fallback to original on error
        }
      }
      img.onerror = () => {
        resolve(file) // Fallback to original if browser can't decode (e.g. raw HEIC on Chrome)
      }
      img.src = reader.result as string
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}

export async function uploadPhoto(file: File): Promise<{ url: string; fileName: string }> {
  const optimizedFile = await optimizeImageToWebP(file)
  
  const timestamp = Date.now()
  const safeName = optimizedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')

  try {
    const path = `companies/${COMPANY_ID}/photos/${timestamp}_${safeName}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, optimizedFile)
    const url = await getDownloadURL(storageRef)
    return { url, fileName: safeName }
  } catch (storageErr: any) {
    console.warn('Firebase Storage upload failed:', storageErr.message || storageErr)
    throw new Error(`Failed to upload photo: ${storageErr.message || storageErr}`)
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
