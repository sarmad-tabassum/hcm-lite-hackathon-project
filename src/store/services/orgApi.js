import { api } from '../apiBase'

// M2 — Org setup: company, departments, designations, leave types, holidays, roles
export const orgApi = api.injectEndpoints({
  endpoints: (b) => ({
    getCompany: b.query({ query: () => '/company', providesTags: ['Org'] }),
    createCompany: b.mutation({
      query: (body) => ({ url: '/company', method: 'POST', body }),
      invalidatesTags: ['Me', 'Org', 'Dashboard'],
    }),
    updateCompany: b.mutation({
      query: (body) => ({ url: '/company', method: 'PATCH', body }),
      invalidatesTags: ['Me', 'Org'],
    }),

    getDepartments: b.query({ query: () => '/departments', providesTags: ['Org'] }),
    saveDepartment: b.mutation({
      query: ({ id, ...body }) => ({ url: id ? `/departments/${id}` : '/departments', method: id ? 'PATCH' : 'POST', body }),
      invalidatesTags: ['Org', 'Employees'],
    }),
    deleteDepartment: b.mutation({
      query: (id) => ({ url: `/departments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Org', 'Employees'],
    }),

    getDesignations: b.query({ query: () => '/designations', providesTags: ['Org'] }),
    saveDesignation: b.mutation({
      query: ({ id, ...body }) => ({ url: id ? `/designations/${id}` : '/designations', method: id ? 'PATCH' : 'POST', body }),
      invalidatesTags: ['Org', 'Employees'],
    }),
    deleteDesignation: b.mutation({
      query: (id) => ({ url: `/designations/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Org', 'Employees'],
    }),

    getLeaveTypes: b.query({ query: () => '/leave-types', providesTags: ['Org'] }),
    saveLeaveType: b.mutation({
      query: ({ id, ...body }) => ({ url: id ? `/leave-types/${id}` : '/leave-types', method: id ? 'PATCH' : 'POST', body }),
      invalidatesTags: ['Org', 'Leaves', 'Dashboard'],
    }),
    deleteLeaveType: b.mutation({
      query: (id) => ({ url: `/leave-types/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Org', 'Leaves'],
    }),

    getHolidays: b.query({ query: () => '/holidays', providesTags: ['Org'] }),
    saveHoliday: b.mutation({
      query: ({ id, ...body }) => ({ url: id ? `/holidays/${id}` : '/holidays', method: id ? 'PATCH' : 'POST', body }),
      invalidatesTags: ['Org', 'Leaves'],
    }),
    deleteHoliday: b.mutation({
      query: (id) => ({ url: `/holidays/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Org', 'Leaves'],
    }),

    getProfiles: b.query({ query: () => '/roles', providesTags: ['Org'] }),
    updateRole: b.mutation({
      query: ({ id, role }) => ({ url: `/roles/${id}`, method: 'PATCH', body: { role } }),
      invalidatesTags: ['Org', 'Employees', 'Me'],
    }),
  }),
})

export const {
  useGetCompanyQuery, useCreateCompanyMutation, useUpdateCompanyMutation,
  useGetDepartmentsQuery, useSaveDepartmentMutation, useDeleteDepartmentMutation,
  useGetDesignationsQuery, useSaveDesignationMutation, useDeleteDesignationMutation,
  useGetLeaveTypesQuery, useSaveLeaveTypeMutation, useDeleteLeaveTypeMutation,
  useGetHolidaysQuery, useSaveHolidayMutation, useDeleteHolidayMutation,
  useGetProfilesQuery, useUpdateRoleMutation,
} = orgApi
