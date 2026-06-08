<template>
  <div class="reports-page">
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon blue">
            <el-icon :size="28"><TrendCharts /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ monthReport.occupancyRate || 0 }}%</div>
            <div class="stat-label">本月入住率</div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon green">
            <el-icon :size="28"><Money /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">¥{{ (monthReport.adr || 0).toFixed(0) }}</div>
            <div class="stat-label">平均房价 (ADR)</div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon orange">
            <el-icon :size="28"><Histogram /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">¥{{ (monthReport.revpar || 0).toFixed(0) }}</div>
            <div class="stat-label">RevPAR</div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon purple">
            <el-icon :size="28"><Wallet /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">¥{{ (monthReport.totalRevenue || 0).toFixed(0) }}</div>
            <div class="stat-label">本月营收</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="14">
        <el-card>
          <template #header>
            <div class="card-header-flex">
              <span>入住率趋势</span>
              <el-radio-group v-model="trendDays" size="small" @change="loadTrend">
                <el-radio-button :value="7">近7天</el-radio-button>
                <el-radio-button :value="30">近30天</el-radio-button>
                <el-radio-button :value="90">近90天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="occupancyChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      
      <el-col :span="10">
        <el-card>
          <template #header>
            <span>营收趋势</span>
          </template>
          <div ref="revenueChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="16" style="margin-top: 16px">
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
    
    <el-card style="margin-top: 16px">
      <template #header>
        <div class="card-header-flex">
          <span>月度报表</span>
          <div>
            <el-date-picker
              v-model="reportMonth"
              type="month"
              size="small"
              value-format="YYYY-MM"
              @change="loadMonthly"
            />
            <el-button size="small" type="primary" style="margin-left: 10px" @click="generateReport">
              生成报表
            </el-button>
          </div>
        </div>
      </template>
      
      <el-descriptions :column="4" border>
        <el-descriptions-item label="统计月份">{{ monthReport.month || '-' }}</el-descriptions-item>
        <el-descriptions-item label="总房间数">{{ monthReport.totalRooms || 0 }} 间</el-descriptions-item>
        <el-descriptions-item label="可用间夜">{{ monthReport.availableRoomNights || 0 }}</el-descriptions-item>
        <el-descriptions-item label="已售间夜">{{ monthReport.occupiedRoomNights || 0 }}</el-descriptions-item>
        <el-descriptions-item label="入住率">
          <span class="highlight">{{ monthReport.occupancyRate || 0 }}%</span>
        </el-descriptions-item>
        <el-descriptions-item label="ADR (平均房价)">
          <span class="highlight">¥{{ monthReport.adr || 0 }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="RevPAR">
          <span class="highlight">¥{{ monthReport.revpar || 0 }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="总营收">
          <span class="highlight revenue">¥{{ (monthReport.totalRevenue || 0).toFixed(2) }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { TrendCharts, Money, Histogram, Wallet } from '@element-plus/icons-vue'
import {
  getMonthlyReport,
  getOccupancyTrend,
  getRevenueTrend,
  getRoomTypeStats,
  getChannelStats,
} from '../api'

const trendDays = ref(30)
const reportMonth = ref(dayjs().format('YYYY-MM'))
const monthReport = reactive({})

const occupancyChartRef = ref(null)
const revenueChartRef = ref(null)
const roomTypeChartRef = ref(null)
const channelChartRef = ref(null)

let occupancyChart = null
let revenueChart = null
let roomTypeChart = null
let channelChart = null

const loadMonthly = async () => {
  try {
    const [year, month] = reportMonth.value.split('-').map(Number)
    const res = await getMonthlyReport({ year, month })
    Object.assign(monthReport, res)
  } catch (e) {}
}

const loadTrend = async () => {
  try {
    const [occ, rev] = await Promise.all([
      getOccupancyTrend(trendDays.value),
      getRevenueTrend(trendDays.value),
    ])
    
    nextTick(() => {
      initOccupancyChart(occ)
      initRevenueChart(rev)
    })
  } catch (e) {}
}

const loadRoomTypeStats = async () => {
  try {
    const res = await getRoomTypeStats({
      start_date: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      end_date: dayjs().format('YYYY-MM-DD'),
    })
    nextTick(() => {
      initRoomTypeChart(res.stats)
    })
  } catch (e) {}
}

const loadChannelStats = async () => {
  try {
    const res = await getChannelStats({
      start_date: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      end_date: dayjs().format('YYYY-MM-DD'),
    })
    nextTick(() => {
      initChannelChart(res.stats)
    })
  } catch (e) {}
}

const generateReport = () => {
  loadMonthly()
}

const initOccupancyChart = (data) => {
  if (!occupancyChartRef.value) return
  if (occupancyChart) occupancyChart.dispose()
  
  occupancyChart = echarts.init(occupancyChartRef.value)
  occupancyChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date.substr(5)),
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%' },
    },
    series: [{
      type: 'line',
      data: data.map(d => d.occupancyRate),
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

const initRevenueChart = (data) => {
  if (!revenueChartRef.value) return
  if (revenueChart) revenueChart.dispose()
  
  revenueChart = echarts.init(revenueChartRef.value)
  revenueChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date.substr(5)),
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: '¥{value}' },
    },
    series: [
      {
        name: '退房收入',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.checkoutRevenue),
        itemStyle: { color: '#67c23a' },
      },
      {
        name: '预订收入',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.bookingRevenue),
        itemStyle: { color: '#e6a23c' },
      },
    ],
  })
}

const initRoomTypeChart = (data) => {
  if (!roomTypeChartRef.value) return
  if (roomTypeChart) roomTypeChart.dispose()
  
  roomTypeChart = echarts.init(roomTypeChartRef.value)
  roomTypeChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}间夜 ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['35%', '50%'],
      data: data.map(d => ({
        name: d.room_type_name,
        value: d.booked_nights,
      })),
      label: { show: false },
    }],
  })
}

const initChannelChart = (data) => {
  if (!channelChartRef.value) return
  if (channelChart) channelChart.dispose()
  
  const channelNames = {
    direct: '直营',
    ctrip: '携程',
    meituan: '美团',
    fliggy: '飞猪',
  }
  
  channelChart = echarts.init(channelChartRef.value)
  channelChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.map(d => channelNames[d.channel] || d.channel),
    },
    yAxis: [
      { type: 'value', name: '订单数' },
      { type: 'value', name: '营收(元)' },
    ],
    series: [
      {
        name: '订单数',
        type: 'bar',
        data: data.map(d => d.order_count),
        itemStyle: { color: '#67c23a' },
      },
      {
        name: '营收',
        type: 'bar',
        yAxisIndex: 1,
        data: data.map(d => d.total_revenue),
        itemStyle: { color: '#e6a23c' },
      },
    ],
  })
}

onMounted(async () => {
  await loadMonthly()
  await loadTrend()
  await loadRoomTypeStats()
  await loadChannelStats()
})
</script>

<style scoped lang="scss">
.reports-page {
  .stat-card {
    :deep(.el-card__body) {
      display: flex;
      align-items: center;
      padding: 20px;
    }
    
    .stat-icon {
      width: 50px;
      height: 50px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      margin-right: 16px;
      
      &.blue { background: linear-gradient(135deg, #409eff 0%, #79bbff 100%); }
      &.green { background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%); }
      &.orange { background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%); }
      &.purple { background: linear-gradient(135deg, #909399 0%, #a6a9ad 100%); }
    }
    
    .stat-info {
      .stat-value {
        font-size: 22px;
        font-weight: 600;
        color: #303133;
      }
      
      .stat-label {
        font-size: 13px;
        color: #909399;
        margin-top: 4px;
      }
    }
  }
  
  .chart-container {
    height: 300px;
  }
  
  .chart-container-sm {
    height: 260px;
  }
  
  .card-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .highlight {
    font-weight: 600;
    color: #409eff;
    
    &.revenue {
      color: #f56c6c;
      font-size: 16px;
    }
  }
}
</style>
