import { defineStore } from 'pinia'
import { login, getCurrentUser } from '../api'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('pms_token') || '',
    user: JSON.parse(localStorage.getItem('pms_user') || 'null'),
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    username: (state) => state.user?.name || '',
    role: (state) => state.user?.role || '',
  },
  actions: {
    async login(credentials) {
      const res = await login(credentials)
      this.token = res.token
      this.user = res.user
      localStorage.setItem('pms_token', res.token)
      localStorage.setItem('pms_user', JSON.stringify(res.user))
      return res
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('pms_token')
      localStorage.removeItem('pms_user')
    },
    async fetchUser() {
      try {
        const res = await getCurrentUser()
        this.user = res.user
        return res.user
      } catch (e) {
        this.logout()
        throw e
      }
    },
  },
})
