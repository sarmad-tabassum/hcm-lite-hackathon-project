import { api } from '../apiBase'

// M8 — AI assistant (tool-calling on the server)
export const aiApi = api.injectEndpoints({
  endpoints: (b) => ({
    chatAi: b.mutation({
      query: (body) => ({ url: '/ai/chat', method: 'POST', body }),
    }),
  }),
})

export const { useChatAiMutation } = aiApi
