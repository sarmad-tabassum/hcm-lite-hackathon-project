import { api } from '../apiBase'

// M9 — Audit log (admin only)
export const auditApi = api.injectEndpoints({
  endpoints: (b) => ({
    getAuditLogs: b.query({
      query: (params) => ({ url: '/audit', params }),
      providesTags: ['Audit'],
    }),
  }),
})

export const { useGetAuditLogsQuery } = auditApi
