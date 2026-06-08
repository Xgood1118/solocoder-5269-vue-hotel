import { defineStore } from 'pinia'
import { getBookings, createBooking, updateBooking, updateBookingStatus } from '../api'

export const useBookingStore = defineStore('booking', {
  state: () => ({
    bookings: [],
    total: 0,
    currentPage: 1,
    pageSize: 20,
  }),
  actions: {
    async fetchBookings(params = {}) {
      const res = await getBookings({
        page: this.currentPage,
        pageSize: this.pageSize,
        ...params,
      })
      this.bookings = res.list
      this.total = res.total
      return res
    },
    async createBooking(data) {
      const res = await createBooking(data)
      return res
    },
    async updateBooking(id, data) {
      const res = await updateBooking(id, data)
      return res
    },
    async updateStatus(id, status) {
      const res = await updateBookingStatus(id, status)
      return res
    },
  },
})
