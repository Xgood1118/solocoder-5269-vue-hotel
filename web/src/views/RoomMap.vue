<template>
  <div class="room-map">
    <el-card class="map-toolbar">
      <div class="toolbar-left">
        <el-button :icon="ArrowLeft" circle size="small" @click="changeDate(-1)" />
        <el-date-picker
          v-model="startDate"
          type="date"
          size="small"
          style="width: 140px; margin: 0 8px;"
          @change="loadRoomMap"
        />
        <el-button :icon="ArrowRight" circle size="small" @click="changeDate(1)" />
        <span class="date-range">{{ dateRangeText }}</span>
      </div>
      
      <div class="toolbar-right">
        <div class="legend">
          <span class="legend-item"><span class="dot available"></span>可售</span>
          <span class="legend-item"><span class="dot booked"></span>已订</span>
          <span class="legend-item"><span class="dot occupied"></span>在住</span>
          <span class="legend-item"><span class="dot dirty"></span>脏房</span>
          <span class="legend-item"><span class="dot maintenance"></span>维修</span>
        </div>
      </div>
    </el-card>
    
    <el-card class="map-container" v-loading="loading">
      <div class="room-map-wrapper" ref="mapWrapperRef">
        <table class="room-map-table">
          <thead>
            <tr>
              <th class="room-no-header">房号 / 房型</th>
              <th 
                v-for="date in dateList" 
                :key="date"
                :class="['date-header', { today: isToday(date), weekend: isWeekend(date) }]"
              >
                <div class="date-month">{{ getMonth(date) }}</div>
                <div class="date-day">{{ getDay(date) }}</div>
                <div class="date-week">{{ getWeek(date) }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="room in roomMapData" :key="room.id">
              <tr class="room-row">
                <td class="room-no-cell">
                  <div class="room-no">{{ room.room_no }}</div>
                  <div class="room-type">{{ room.room_type_name }}</div>
                </td>
                <td 
                  v-for="date in dateList" 
                  :key="date"
                  :class="['status-cell', getStatusClass(room, date)]"
                  @click="handleCellClick(room, date)"
                >
                  <span class="status-text" v-if="room.statuses[date]?.guestName">
                    {{ room.statuses[date].guestName }}
                  </span>
                  <span class="status-dot" v-else></span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </el-card>
    
    <el-dialog v-model="detailVisible" title="房态详情" width="500px">
      <div v-if="selectedRoom" class="detail-content">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="房号">{{ selectedRoom.room_no }}</el-descriptions-item>
          <el-descriptions-item label="房型">{{ selectedRoom.room_type_name }}</el-descriptions-item>
          <el-descriptions-item label="日期">{{ selectedDate }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusTagType(selectedStatus?.status)">{{ getStatusText(selectedStatus?.status) }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        
        <div class="detail-actions" v-if="selectedStatus">
          <el-button 
            v-if="selectedStatus.status === 'dirty'" 
            type="primary" 
            @click="handleCleanRoom"
          >
            标记清洁
          </el-button>
          <el-button 
            v-if="selectedStatus.status === 'booked' || selectedStatus.status === 'occupied'"
            @click="goToBooking"
          >
            查看订单
          </el-button>
          <el-button 
            v-if="selectedStatus.status === 'booked'"
            type="success"
            @click="goToCheckin"
          >
            办理入住
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getRoomMapStatuses, cleanRoom, getRoom } from '../api'

const router = useRouter()
const loading = ref(false)
const roomMapData = ref([])
const startDate = ref(dayjs().format('YYYY-MM-DD'))
const daysToShow = 14

const detailVisible = ref(false)
const selectedRoom = ref(null)
const selectedDate = ref('')

const dateList = computed(() => {
  const list = []
  const start = dayjs(startDate.value)
  for (let i = 0; i < daysToShow; i++) {
    list.push(start.add(i, 'day').format('YYYY-MM-DD'))
  }
  return list
})

const dateRangeText = computed(() => {
  const start = dateList.value[0]
  const end = dateList.value[dateList.value.length - 1]
  return `${start} 至 ${end}`
})

const selectedStatus = computed(() => {
  if (!selectedRoom.value || !selectedDate.value) return null
  return selectedRoom.value.statuses?.[selectedDate.value]
})

const isToday = (date) => dayjs(date).isSame(dayjs(), 'day')
const isWeekend = (date) => {
  const d = dayjs(date)
  return d.day() === 0 || d.day() === 6
}
const getMonth = (date) => dayjs(date).format('M月')
const getDay = (date) => dayjs(date).format('D')
const getWeek = (date) => {
  const weeks = ['日', '一', '二', '三', '四', '五', '六']
  return '周' + weeks[dayjs(date).day()]
}

const getStatusClass = (room, date) => {
  const status = room.statuses?.[date]?.status || 'available'
  return status
}

const getStatusText = (status) => {
  const map = {
    available: '可售',
    booked: '已订',
    occupied: '在住',
    dirty: '脏房',
    maintenance: '维修中',
  }
  return map[status] || status
}

const getStatusTagType = (status) => {
  const map = {
    available: 'success',
    booked: 'warning',
    occupied: 'danger',
    dirty: 'info',
    maintenance: 'primary',
  }
  return map[status] || 'info'
}

const loadRoomMap = async () => {
  loading.value = true
  try {
    const endDate = dayjs(startDate.value).add(daysToShow, 'day').format('YYYY-MM-DD')
    const res = await getRoomMapStatuses({
      start_date: startDate.value,
      end_date: endDate,
    })
    roomMapData.value = res.rooms
  } finally {
    loading.value = false
  }
}

const changeDate = (delta) => {
  startDate.value = dayjs(startDate.value).add(delta, 'day').format('YYYY-MM-DD')
  loadRoomMap()
}

const handleCellClick = (room, date) => {
  selectedRoom.value = room
  selectedDate.value = date
  detailVisible.value = true
}

const handleCleanRoom = async () => {
  try {
    await ElMessageBox.confirm('确认标记此房间为已清洁？', '提示', {
      type: 'warning',
    })
    await cleanRoom(selectedRoom.value.id)
    ElMessage.success('房间已标记为清洁')
    detailVisible.value = false
    loadRoomMap()
  } catch (e) {
    // cancelled
  }
}

const goToBooking = () => {
  router.push('/bookings')
}

const goToCheckin = () => {
  router.push({
    path: '/checkin',
    query: {
      roomId: selectedRoom.value?.id,
      date: selectedDate.value,
    },
  })
}

onMounted(() => {
  loadRoomMap()
})
</script>

<style scoped lang="scss">
.room-map {
  .map-toolbar {
    margin-bottom: 16px;
    
    :deep(.el-card__body) {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
    }
  }
  
  .toolbar-left {
    display: flex;
    align-items: center;
    
    .date-range {
      font-size: 14px;
      color: #606266;
      margin-left: 10px;
    }
  }
  
  .legend {
    display: flex;
    gap: 16px;
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #606266;
      
      .dot {
        width: 12px;
        height: 12px;
        border-radius: 2px;
        
        &.available { background-color: #67c23a; }
        &.booked { background-color: #e6a23c; }
        &.occupied { background-color: #f56c6c; }
        &.dirty { background-color: #909399; }
        &.maintenance { background-color: #409eff; }
      }
    }
  }
  
  .map-container {
    :deep(.el-card__body) {
      padding: 0;
    }
  }
  
  .room-map-wrapper {
    overflow-x: auto;
  }
  
  .room-map-table {
    width: 100%;
    min-width: 800px;
    border-collapse: collapse;
    
    th, td {
      border: 1px solid #ebeef5;
      text-align: center;
      padding: 0;
    }
    
    .room-no-header {
      width: 120px;
      min-width: 120px;
      background: #f5f7fa;
      position: sticky;
      left: 0;
      z-index: 2;
    }
    
    .date-header {
      height: 60px;
      background: #f5f7fa;
      min-width: 80px;
      padding: 6px;
      
      .date-month {
        font-size: 12px;
        color: #909399;
      }
      
      .date-day {
        font-size: 18px;
        font-weight: 600;
        color: #303133;
      }
      
      .date-week {
        font-size: 12px;
        color: #909399;
      }
      
      &.today {
        background: #ecf5ff;
        
        .date-day {
          color: #409eff;
        }
      }
      
      &.weekend .date-week {
        color: #f56c6c;
      }
    }
    
    .room-row {
      &:hover td.status-cell {
        opacity: 0.85;
      }
    }
    
    .room-no-cell {
      background: white;
      position: sticky;
      left: 0;
      z-index: 1;
      padding: 10px;
      text-align: left;
      
      .room-no {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }
      
      .room-type {
        font-size: 12px;
        color: #909399;
        margin-top: 2px;
      }
    }
    
    .status-cell {
      height: 50px;
      cursor: pointer;
      transition: opacity 0.2s;
      
      &.available {
        background-color: #f0f9eb;
        color: #67c23a;
      }
      
      &.booked {
        background-color: #fdf6ec;
        color: #e6a23c;
      }
      
      &.occupied {
        background-color: #fef0f0;
        color: #f56c6c;
      }
      
      &.dirty {
        background-color: #f4f4f5;
        color: #909399;
      }
      
      &.maintenance {
        background-color: #ecf5ff;
        color: #409eff;
      }
      
      .status-text {
        font-size: 12px;
        padding: 0 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
      }
    }
  }
  
  .detail-content {
    .detail-actions {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  }
}
</style>
