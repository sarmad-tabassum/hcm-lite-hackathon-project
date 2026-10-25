import { api } from '../apiBase'

// M3 — Employees CRUD + CSV import
export const employeesApi = api.injectEndpoints({
  endpoints: (b) => ({
    getEmployees: b.query({
      query: (params) => ({ url: '/employees', params }),
      providesTags: ['Employees'],
    }),
    createEmployee: b.mutation({
      query: (body) => ({ url: '/employees', method: 'POST', body }),
      invalidatesTags: ['Employees', 'Dashboard', 'Audit'],
    }),
    updateEmployee: b.mutation({
      query: ({ id, ...body }) => ({ url: `/employees/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Employees', 'Dashboard'],
    }),
    terminateEmployee: b.mutation({
      query: (id) => ({ url: `/employees/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Employees', 'Dashboard'],
    }),
    importEmployees: b.mutation({
      query: (rows) => ({ url: '/employees/import', method: 'POST', body: { rows } }),
      invalidatesTags: ['Employees', 'Dashboard', 'Audit'],
    }),
  }),
})

export const {
  useGetEmployeesQuery, useCreateEmployeeMutation, useUpdateEmployeeMutation,
  useTerminateEmployeeMutation, useImportEmployeesMutation,
} = employeesApi
