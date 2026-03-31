export interface LP {
  id: string
  title: string
  direction: 'vertical' | 'horizontal' | 'fullscreen'
  cta: CTA
  steps: Step[]
  createdAt: string
  updatedAt: string
}

export interface Step {
  id: string
  order: number
  image: string
  fileName: string
  createdAt: string
}

export interface CTA {
  text: string
  url: string
  bgColor: string
  textColor: string
  image?: string
}

export interface AnalyticsData {
  lpId: string
  summary: {
    totalSessions: number
    totalCtaClicks: number
    ctaClickRate: number
  }
  computed: StepAnalytics[]
}

export interface StepAnalytics {
  index: number
  views: number
  reachRate: number
  dropRate: number
  avgDuration: number
  avgDurationFormatted: string
  ctaClicks: number
  ctaClickRate: number
}

export interface UploadResult {
  success: boolean
  path: string
  fileName: string
  size: number
  mime: string
}
