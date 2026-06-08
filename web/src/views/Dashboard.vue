<template>
  <div class="dashboard">
    <el-row :gutter="16" class="stats-cards">
      <el-col :span="6">
        <el-card class="stat-card stat-today">
          <div class="stat-icon">
            <el-icon :size="32"><House /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ overview.today?.occupiedRooms || 0 }}</div>
            <div class="stat-label">今日在住</div>
            <div class="stat-sub">入住率 {{ overview.today?.occupancyRate || 0 }}%</div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card stat-income">
          <div class="stat-icon">
            <el-icon :size="32"><Money /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">¥{{ (overview.today?.checkoutRevenue || 0).toFixed(2) }}</div>
            <div class="stat-label">今日营收</div>
            <div class="stat-sub">退房 {{ overview.today?.checkoutsToday || 0 }} 间</div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card stat-booking">
          <div class="stat-icon">
            <el-icon :size="32"><Calendar /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ overview.today?.bookingsToday || 0 }}</div>
            <div class="stat-label">今日预订</div>
            <div class="stat-sub">预订金额 ¥{{ (overview.today?.bookingRevenue || 0).toFixed(2) }}</div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card stat-checkin">
          <div class="stat-icon">
            <el-icon :size="32"><Key /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ overview.today?.checkinsToday || 0 }}</div>
            <div class="stat-label">今日入住</div>
            <div class="stat-sub">总房间 {{ overview.today?.totalRooms || 0 }} 间</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="16" class="charts-row">
      <el-col :span="14">
        <el-card>
          <template #header>
            <div class="card-header-flex">
              <span>入住率趋势 (近30天)</span>
            </div>
          </template>
          <div ref="occupancyChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      
      <el-col :span="10">
        <el-card>
          <template #header>
            <div class="card-header-flex">
              <span>本月经营数据</span>
            </div>
          </template>
          <div class="month-stats">
            <div class="month-stat-item">
              <span class="label">入住率</span>
              <span class="value">{{ overview.thisMonth?.occupancyRate || 0 }}%</span>
            </div>
            <div class="month-stat-item">
              <span class="label">ADR (平均房价)</span>
              <span class="value">¥{{ overview.thisMonth?.adr || 0 }}</span>
            </div>
            <div class="month-stat-item">
              <span class="label">RevPAR</span>
              <span class="value">¥{{ overview.thisMonth?.revpar || 0 }}</span>
            </div>
            <div class="month-stat-item">
              <span class="label">总营收</span>
              <span class="value revenue">¥{{ (overview.thisMonth?.totalRevenue || 0).toFixed(2) }}</span>
            </div>
            <div class="month-stat-item">
              <span class="label">已售间夜</span>
              <span class="value">{{ overview.thisMonth?.occupiedRoomNights || 0 }} 间夜</span>
            </div>
            <div class="month-stat-item">
              <span class="label">可用间夜</span>
              <span class="value">{{ overview.thisMonth?.availableRoomNights || 0 }} 间夜</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="16" class="charts-row">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>房型销售统计</span>
          </template>
          <div ref="roomTypeChartRef" class="chart-container-sm"></div>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>渠道订单分布</span>
          </template>
          <div ref="channelChartRef" class="chart-container-sm"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { getOverviewReport, getOccupancyTrend, getRoomTypeStats, getChannelStats } from '../api'
import { House, Money, Calendar, Key } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const overview = ref({})
const occupancyTrend = ref([])
const roomTypeStats = ref([])
const channelStats = ref([])

const occupancyChartRef = ref(null)
const roomTypeChartRef = ref(null)
const channelChartRef = ref(null)

let occupancyChart = null
let roomTypeChart = null
let channelChart = null

const loadData = async () => {
  const [ov, trend, rt, ch] = await Promise.all([
    getOverviewReport(),
    getOccupancyTrend(30),
    getRoomTypeStats({
      start_date: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      end_date: dayjs().format('YYYY-MM-DD'),
    }),
    getChannelStats({
      start_date: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      end_date: dayjs().format('YYYY-MM-DD'),
    }),
  ])
  overview.value = ov
  occupancyTrend.value = trend
  roomTypeStats.value = rt.stats
  channelStats.value = ch.stats
  
  nextTick(() => {
    initOccupancyChart()
    initRoomTypeChart()
    initChannelChart()
  })
}

const initOccupancyChart = () => {
  if (!occupancyChartRef.value) return
  if (occupancyChart) occupancyChart.dispose()
  
  occupancyChart = echarts.init(occupancyChartRef.value)
  occupancyChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: 'category',
      data: occupancyTrend.value.map(d => d.date.substr(5)),
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%' },
    },
    series: [{
      type: 'line',
      data: occupancyTrend.value.map(d => d.occupancyRate),
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
          { offset: 1, color: 'rgba(64, 158, 255, 0.05)' },
        ]),
      },
      lineStyle: { color: '#409eff', width: 2 },
      itemStyle: { color: '#409eff' },
    }],
  })
}

const initRoomTypeChart = () => {
  if (!roomTypeChartRef.value) return
  if (roomTypeChart) roomTypeChart.dispose()
  
  roomTypeChart = echarts.init(roomTypeChartRef.value)
  roomTypeChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['35%', '50%'],
      data: roomTypeStats.value.map(d => ({
        name: d.room_type_name,
        value: d.revenue,
      })),
      label: { show: false },
    }],
  })
}

const initChannelChart = () => {
  if (!channelChartRef.value) return
  if (channelChart) channelChart.dispose()
  
  channelChart = echarts.init(channelChartRef.value)
  
  const channelNames = {
    direct: '直营',
    ctrip: '携程',
    meituan: '美团',
    fliggy: '飞猪',
  }
  
  channelChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['订单数', '营收'] },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: channelStats.value.map(d => channelNames[d.channel] || d.channel),
    },
    yAxis: [
      { type: 'value', name: '订单数' },
      { type: 'value', name: '营收(元)' },
    ],
    series: [
      {
        name: '订单数',
        type: 'bar',
        data: channelStats.value.map(d => d.order_count),
        itemStyle: { color: '#67c23a' },
      },
      {
        name: '营收',
        type: 'bar',
        yAxisIndex: 1,
        data: channelStats.value.map(d => d.total_revenue),
        itemStyle: { color: '#e6a23c' },
      },
    ],
  })
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.dashboard {
  .stats-cards {
    margin-bottom: 16px;
  }
  
  .stat-card {
    :deep(.el-card__body) {
      display: flex;
      align-items: center;
      padding: 20px;
    }
    
    .stat-icon {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      margin-right: 16px;
    }
    
    &.stat-today .stat-icon {
      background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
    }
    &.stat-income .stat-icon {
      background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%);
    }
    &.stat-booking .stat-icon {
      background: linear-gradient(135deg, #409eff 0%, #79bbff 100%);
    }
    &.stat-checkin .stat-icon {
      background: linear-gradient(135deg, #f56c6c 0%, #f78989 100%);
    }
    
    .stat-content {
      flex: 1;
      
      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: #303133;
        line-height: 1.2;
      }
      
      .stat-label {
        font-size: 14px;
        color: #606266;
        margin: 4px 0;
      }
      
      .stat-sub {
        font-size: 12px;
        color: #909399;
      }
    }
  }
  
  .charts-row {
    margin-bottom: 16px;
  }
  
  .chart-container {
    height: 300px;
  }
  
  .chart-container-sm {
    height: 260px;
  }
  
  .card-header-flex {
    font-weight: 600;
  }
  
  .month-stats {
    .month-stat-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #ebeef5;
      
      .label {
        color: #606266;
        font-size: 14px;
      }
      
      .value {
        font-weight: 600;
        color: #303133;
        font-size: 14px;
        
        &.revenue {
          color: #f56c6c;
          font-size: 16px;
        }
      }
      
      &:last-child {
        border-bottom: none;
      }
    }
  }
}
</style>
