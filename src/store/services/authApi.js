import { api } from '../apiBase'
import { setProfile } from '../features/authSlice'

export const authApi = api.injectEndpoints({
  endpoints: (b) => ({
    syncUser: b.mutation({
      query: (body) => ({ url: '/auth/sync', method: 'POST', body }),
      invalidatesTags: ['Me'],
    }),
    getMe: b.query({
      query: () => '/auth/me',
      providesTags: ['Me'],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setProfile(data.profile || null))
        } catch {
          /* handled by callers */
        }
      },
    }),
    updateProfile: b.mutation({
      query: (body) => ({ url: '/auth/me', method: 'PUT', body }),
      invalidatesTags: ['Me'],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (data?.profile) dispatch(setProfile(data.profile))
        } catch {}
      },
    }),
    getJoinCodes: b.query({
      query: () => '/auth/join-codes',
      providesTags: ['Me'],
    }),
    // Admin approval queue for self-registered HR/employee accounts
    getApprovals: b.query({
      query: () => '/admin/approvals',
      providesTags: ['Approvals'],
    }),
    decideApproval: b.mutation({
      query: ({ user_id, action }) => ({
        url: '/admin/approvals',
        method: 'POST',
        body: { user_id, action },
      }),
      invalidatesTags: ['Approvals', 'Me', 'Employees', 'Dashboard'],
    }),
  }),
})

export const { useSyncUserMutation, useGetMeQuery, useUpdateProfileMutation, useGetJoinCodesQuery, useGetApprovalsQuery, useDecideApprovalMutation } = authApi
