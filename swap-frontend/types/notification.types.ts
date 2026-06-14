export interface Notification {
  id: string
  type: string
  data: {
    title: string
    message: string
    type: string
    [key: string]: unknown
  }
  read_at: string | null
  is_read: boolean
  created_at: string
}
