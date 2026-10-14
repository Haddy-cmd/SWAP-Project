import apiClient from './axios'

/** The admin sidebar's flag: whether System Testing is on on this server (SWAP_TEST_TOOLS). */
export interface SystemState {
  test_tools_available: boolean
}

export const systemApi = {
  get: () => apiClient.get<{ data: SystemState }>('/admin/system').then((r) => r.data.data),
}
