import { configureStore } from '@reduxjs/toolkit'
import { api } from './apiBase'
import auth from './features/authSlice'

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
})
