import { defineStore } from 'pinia'
import { getRooms, getRoomTypes, getRoomMapStatuses } from '../api'

export const useRoomStore = defineStore('room', {
  state: () => ({
    rooms: [],
    roomTypes: [],
    roomMapData: null,
    mapStartDate: '',
    mapEndDate: '',
  }),
  actions: {
    async fetchRooms(params) {
      const res = await getRooms(params)
      this.rooms = res
      return res
    },
    async fetchRoomTypes() {
      const res = await getRoomTypes()
      this.roomTypes = res
      return res
    },
    async fetchRoomMap(startDate, endDate) {
      const res = await getRoomMapStatuses({
        start_date: startDate,
        end_date: endDate,
      })
      this.roomMapData = res.rooms
      this.mapStartDate = res.startDate
      this.mapEndDate = res.endDate
      return res
    },
  },
})
