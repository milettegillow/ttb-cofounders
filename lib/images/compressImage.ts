/**
 * Client-side image compression utility
 * Resizes and compresses images to reduce upload size
 */

export interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'webp' | 'jpeg'
}

export interface CompressResult {
  blob: Blob
  dataUrl: string
  originalSize: number
  compressedSize: number
}

/**
 * Compress an image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise with compressed blob, data URL, and size info
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 0.8,
    format = 'webp',
  } = options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width
        let height = img.height
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }
        
        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)
        
        const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg'
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression failed'))
              return
            }
            
            const dataUrl = canvas.toDataURL(mimeType, quality)
            
            resolve({
              blob,
              dataUrl,
              originalSize: file.size,
              compressedSize: blob.size,
            })
          },
          mimeType,
          quality
        )
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
      
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsDataURL(file)
  })
}
