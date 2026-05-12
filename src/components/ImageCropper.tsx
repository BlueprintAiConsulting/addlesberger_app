import { useState, useRef, useCallback, useEffect } from 'react'
import { Crop, RotateCcw, Check, X } from 'lucide-react'

interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

interface ImageCropperProps {
  imageUrl: string
  onCrop: (croppedBlob: Blob) => void
  onCancel: () => void
}

/**
 * Inline image cropper: user drags a rectangle over a whiteboard photo,
 * then the cropped region is exported as a Blob for AI processing.
 * Supports mouse + touch. No external dependencies.
 */
export function ImageCropper({ imageUrl, onCrop, onCancel }: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [imgLoaded, setImgLoaded] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [startPt, setStartPt] = useState<{ x: number; y: number } | null>(null)
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })

  // Load the image once
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
    }
    img.onerror = () => {
      // Retry without crossOrigin
      const img2 = new Image()
      img2.onload = () => {
        imgRef.current = img2
        setImgLoaded(true)
      }
      img2.src = imageUrl
    }
    img.src = imageUrl
  }, [imageUrl])

  // Compute displayed image size inside the container
  useEffect(() => {
    if (!imgLoaded || !containerRef.current || !imgRef.current) return
    const container = containerRef.current
    const natW = imgRef.current.naturalWidth
    const natH = imgRef.current.naturalHeight
    const maxW = container.clientWidth
    const maxH = window.innerHeight * 0.55
    const scale = Math.min(maxW / natW, maxH / natH, 1)
    setDisplaySize({ w: natW * scale, h: natH * scale })
  }, [imgLoaded])

  const getRelPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: Math.max(0, Math.min(clientX - rect.left, displaySize.w)),
      y: Math.max(0, Math.min(clientY - rect.top, displaySize.h)),
    }
  }, [displaySize])

  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const pt = getRelPos(e)
    setStartPt(pt)
    setCrop(null)
    setDrawing(true)
  }, [getRelPos])

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !startPt) return
    e.preventDefault()
    const pt = getRelPos(e)
    setCrop({
      x: Math.min(startPt.x, pt.x),
      y: Math.min(startPt.y, pt.y),
      w: Math.abs(pt.x - startPt.x),
      h: Math.abs(pt.y - startPt.y),
    })
  }, [drawing, startPt, getRelPos])

  const onPointerUp = useCallback(() => {
    setDrawing(false)
    // If tiny crop (accidental click), reset
    if (crop && (crop.w < 20 || crop.h < 20)) {
      setCrop(null)
    }
  }, [crop])

  const resetCrop = () => {
    setCrop(null)
    setStartPt(null)
  }

  const confirmCrop = useCallback(() => {
    if (!crop || !imgRef.current) return

    const img = imgRef.current
    const scaleX = img.naturalWidth / displaySize.w
    const scaleY = img.naturalHeight / displaySize.h

    // Map display coords back to natural image coords
    const sx = crop.x * scaleX
    const sy = crop.y * scaleY
    const sw = crop.w * scaleX
    const sh = crop.h * scaleY

    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    canvas.toBlob(blob => {
      if (blob) onCrop(blob)
    }, 'image/jpeg', 0.92)
  }, [crop, displaySize, onCrop])

  if (!imgLoaded) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
        Loading image for cropping...
      </div>
    )
  }

  return (
    <div className="stack stack-sm">
      {/* Instructions */}
      <div style={{
        padding: '10px 14px',
        borderRadius: 'var(--radius-sm)',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(59,130,246,0.08))',
        border: '1px solid rgba(124,58,237,0.2)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
      }}>
        <Crop size={15} style={{ color: '#7C3AED', flexShrink: 0 }} />
        <span>Drag on the image to select the area with text you want the AI to read.</span>
      </div>

      {/* Crop canvas */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: displaySize.w,
          height: displaySize.h,
          margin: '0 auto',
          cursor: crop ? 'default' : 'crosshair',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      >
        {/* Base image */}
        <img
          src={imageUrl}
          alt="Crop target"
          draggable={false}
          style={{
            width: displaySize.w,
            height: displaySize.h,
            display: 'block',
            filter: crop ? 'brightness(0.4)' : 'none',
            transition: 'filter 0.2s',
          }}
        />

        {/* Bright crop region overlay */}
        {crop && crop.w > 5 && crop.h > 5 && (
          <div style={{
            position: 'absolute',
            left: crop.x,
            top: crop.y,
            width: crop.w,
            height: crop.h,
            overflow: 'hidden',
            border: '2px solid #7C3AED',
            borderRadius: 4,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
            pointerEvents: 'none',
          }}>
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: -crop.x,
                top: -crop.y,
                width: displaySize.w,
                height: displaySize.h,
              }}
            />
            {/* Corner handles for visual flair */}
            {[
              { top: -2, left: -2 },
              { top: -2, right: -2 },
              { bottom: -2, left: -2 },
              { bottom: -2, right: -2 },
            ].map((pos, i) => (
              <div key={i} style={{
                position: 'absolute',
                ...pos,
                width: 10,
                height: 10,
                borderRadius: 2,
                background: '#7C3AED',
              }} />
            ))}
          </div>
        )}

        {/* Crop size indicator */}
        {drawing && crop && crop.w > 40 && crop.h > 25 && (
          <div style={{
            position: 'absolute',
            left: crop.x + crop.w / 2,
            top: crop.y + crop.h / 2,
            transform: 'translate(-50%, -50%)',
            fontSize: 11,
            fontWeight: 600,
            color: 'white',
            background: 'rgba(124,58,237,0.85)',
            padding: '3px 8px',
            borderRadius: 4,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            {Math.round(crop.w)} × {Math.round(crop.h)}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="row gap-sm" style={{ justifyContent: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          <X size={15} /> Cancel
        </button>
        {crop && (
          <button className="btn btn-outline btn-sm" onClick={resetCrop}>
            <RotateCcw size={15} /> Redraw
          </button>
        )}
        <button
          className="btn btn-primary btn-sm"
          onClick={confirmCrop}
          disabled={!crop || crop.w < 20 || crop.h < 20}
          style={{
            background: crop && crop.w >= 20 ? 'linear-gradient(135deg, #7C3AED, #9333EA)' : undefined,
            border: 'none',
          }}
        >
          <Check size={15} /> Crop & Scan
        </button>
      </div>
    </div>
  )
}
