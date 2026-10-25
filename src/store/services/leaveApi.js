import { api } from '../apiBase'

// M5 — Leave
export const leaveApi = api.injectEndpoints({
  endpoints: (b) => ({
    getLeaveRequests: b.query({
      query: (params) => ({ url: '/leave', params }),
      providesTags: ['Leaves'],
    }),
    applyLeave: b.mutation({
      query: (body) => ({ url: '/leave', method: 'POST', body }),
      invalidatesTags: ['Leaves', 'Dashboard'],
    }),
    reviewLeave: b.mutation({
      query: ({ id, ...body }) => ({ url: `/leave/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Leaves', 'Dashboard', 'Attendance'],
    }),
    cancelLeave: b.mutation({
      query: (id) => ({ url: `/leave/${id}`, method: 'PATCH', body: { status: 'cancelled' } }),
      invalidatesTags: ['Leaves', 'Dashboard'],
    }),
  }),
})

export const {
  useGetLeaveRequestsQuery, useApplyLeaveMutation, useReviewLeaveMutation, useCancelLeaveMutation,
} = leaveApi
