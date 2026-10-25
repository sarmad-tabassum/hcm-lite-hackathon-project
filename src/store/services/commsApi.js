import { api } from '../apiBase'

// Announcements + notifications
export const commsApi = api.injectEndpoints({
  endpoints: (b) => ({
    getAnnouncements: b.query({ query: () => '/announcements', providesTags: ['Comms'] }),
    createAnnouncement: b.mutation({
      query: (body) => ({ url: '/announcements', method: 'POST', body }),
      invalidatesTags: ['Comms', 'Dashboard'],
    }),
    getNotifications: b.query({ query: () => '/notifications', providesTags: ['Comms'] }),
    markNotificationsRead: b.mutation({
      query: () => ({ url: '/notifications', method: 'PATCH' }),
      invalidatesTags: ['Comms'],
    }),
  }),
})

export const {
  useGetAnnouncementsQuery, useCreateAnnouncementMutation,
  useGetNotificationsQuery, useMarkNotificationsReadMutation,
} = commsApi
