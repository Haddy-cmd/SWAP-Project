// Mirrors swap-backend/app/Resources/LandingPhotoResource.php and the public
// GET /landing/photos payload (LandingPhotoService::carousel).

/** A carousel slide as the public landing page receives it. */
export interface CarouselPhoto {
  id: number
  caption: string
  url: string
}

/** A carousel slide as the admin editor sees it. */
export interface LandingPhoto extends CarouselPhoto {
  is_active: boolean
  sort_order: number
  source: 'built_in' | 'uploaded'
  width: number | null
  height: number | null
  byte_size: number | null
  updated_at: string | null
}
