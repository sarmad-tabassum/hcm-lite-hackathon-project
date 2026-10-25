import { createSlice } from '@reduxjs/toolkit'

const authSlice = createSlice({
  name: 'auth',
  initialState: { sessionUser: null, profile: null, ready: false },
  reducers: {
    setSessionUser(state, action) { state.sessionUser = action.payload },
    setProfile(state, action) { state.profile = action.payload },
    setAuthReady(state, action) { state.ready = action.payload },
    clearAuth(state) { state.sessionUser = null; state.profile = null; state.ready = true },
  },
})

export const { setSessionUser, setProfile, setAuthReady, clearAuth } = authSlice.actions
export default authSlice.reducer
