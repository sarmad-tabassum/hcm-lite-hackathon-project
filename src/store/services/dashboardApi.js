import { api } from '../apiBase'

// M7 — Dashboard aggregates (one request, role-shaped payload)
export const dashboardApi = api.injectEndpoints({
  endpoints: (b) => ({
    getDashboard: b.query({
      query: () => '/dashboard',
      providesTags: ['Dashboard'],
    }),
  }),
})

export const { useGetDashboardQuery } = dashboardApi
