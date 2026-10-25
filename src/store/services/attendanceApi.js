import { api } from '../apiBase'

// M4 — Attendance
export const attendanceApi = api.injectEndpoints({
  endpoints: (b) => ({
    getAttendanceToday: b.query({
      query: () => '/attendance/today',
      providesTags: ['Attendance'],
    }),
    getMyAttendance: b.query({
      query: ({ month, year }) => ({ url: '/attendance/me', params: { month, year } }),
      providesTags: ['Attendance'],
    }),
    getRegister: b.query({
      query: (params) => ({ url: '/attendance/register', params }),
      providesTags: ['Attendance'],
    }),
    checkIn: b.mutation({
      query: (body) => ({ url: '/attendance/check-in', method: 'POST', body }),
      invalidatesTags: ['Attendance', 'Dashboard'],
    }),
    checkOut: b.mutation({
      query: (body) => ({ url: '/attendance/check-out', method: 'POST', body }),
      invalidatesTags: ['Attendance', 'Dashboard'],
    }),
  }),
})

export const {
  useGetAttendanceTodayQuery, useGetMyAttendanceQuery, useGetRegisterQuery,
  useCheckInMutation, useCheckOutMutation,
} = attendanceApi
