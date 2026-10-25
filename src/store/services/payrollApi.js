import { api } from '../apiBase'

// M6 — Payroll
export const payrollApi = api.injectEndpoints({
  endpoints: (b) => ({
    getPayroll: b.query({
      query: (params) => ({ url: '/payroll', params }),
      providesTags: ['Payroll'],
    }),
    getMyPayslips: b.query({
      query: () => ({ url: '/payroll', params: { mine: 1 } }),
      providesTags: ['Payroll'],
    }),
    runPayroll: b.mutation({
      query: (body) => ({ url: '/payroll/run', method: 'POST', body }),
      invalidatesTags: ['Payroll', 'Dashboard', 'Audit'],
    }),
    finalizePayroll: b.mutation({
      query: (id) => ({ url: `/payroll/${id}`, method: 'PATCH', body: { action: 'finalize' } }),
      invalidatesTags: ['Payroll', 'Dashboard'],
    }),
  }),
})

export const { useGetPayrollQuery, useGetMyPayslipsQuery, useRunPayrollMutation, useFinalizePayrollMutation } = payrollApi
