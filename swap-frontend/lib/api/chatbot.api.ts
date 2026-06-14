import apiClient from './axios'
import type { ApiResponse } from '@/types/api.types'

export interface ChatbotResponse {
  answer: string
  faq_id: number | null
  confidence: number
  category: string
}

export const chatbotApi = {
  query: (message: string) =>
    apiClient.get<ApiResponse<ChatbotResponse>>('/chatbot/query', { params: { message } }).then((r) => r.data.data),
}
