<template>
  <div class="channels-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="card-title">渠道管理</span>
          <div>
            <el-button :icon="Refresh" @click="loadSyncStatus">刷新同步</el-button>
            <el-button type="primary" :icon="Promotion" @click="triggerSync">触发同步</el-button>
          </div>
        </div>
      </template>
      
      <el-row :gutter="16" class="stats-row">
        <el-col :span="6">
          <el-statistic title="待同步" :value="syncStats.pending || 0">
            <template #prefix><el-icon><Clock /></el-icon></template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="同步中" :value="syncStats.retrying || 0">
            <template #prefix><el-icon><Loading /></el-icon></template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="已成功" :value="syncStats.success || 0">
            <template #prefix><el-icon><CircleCheck /></el-icon></template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="死信队列" :value="syncStats.deadLetterCount || 0">
            <template #prefix><el-icon><Warning /></el-icon></template>
          </el-statistic>
        </el-col>
      </el-row>
    </el-card>
    
    <el-card style="margin-top: 16px">
      <template #header>
        <span class="card-title">渠道列表</span>
      </template>
      
      <el-table :data="channels" border stripe>
        <el-table-column prop="code" label="渠道编码" width="100" />
        <el-table-column prop="name" label="渠道名称" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="api_key" label="API Key" show-overflow-tooltip />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="testChannel(row)">测试连接</el-button>
            <el-button type="success" link size="small" @click="pullOrders(row)">拉取订单</el-button>
            <el-button link size="small" @click="editChannel(row)">配置</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-card style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span class="card-title">同步队列</span>
          <el-radio-group v-model="queueStatus" size="small" @change="loadSyncQueue">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="pending">待处理</el-radio-button>
            <el-radio-button value="retrying">重试中</el-radio-button>
            <el-radio-button value="success">成功</el-radio-button>
            <el-radio-button value="failed">失败</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      
      <el-table :data="syncQueue" v-loading="queueLoading" border stripe size="small">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="channel_code" label="渠道" width="100" />
        <el-table-column prop="action" label="操作" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="retry_count" label="重试次数" width="100" align="center" />
        <el-table-column prop="error_msg" label="错误信息" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button 
              v-if="row.status === 'failed' || row.status === 'retrying'"
              type="primary" 
              link 
              size="small"
              @click="retryItem(row)"
            >
              重试
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-card style="margin-top: 16px">
      <template #header>
        <span class="card-title">死信队列 (同步失败 3 次后进入)</span>
      </template>
      
      <el-table :data="deadLetterList" border stripe size="small">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="channel_code" label="渠道" width="100" />
        <el-table-column prop="action" label="操作" width="120" />
        <el-table-column prop="error_msg" label="失败原因" show-overflow-tooltip />
        <el-table-column prop="created_at" label="时间" width="160" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Promotion, Clock, Loading, CircleCheck, Warning } from '@element-plus/icons-vue'
import {
  getChannels,
  getSyncStatus,
  getSyncQueue,
  triggerSync as triggerSyncApi,
  retrySync,
  pullChannelOrders,
} from '../api'

const channels = ref([])
const syncStats = ref({})
const syncQueue = ref([])
const deadLetterList = ref([])
const queueLoading = ref(false)
const queueStatus = ref('')

const loadChannels = async () => {
  try {
    channels.value = await getChannels()
  } catch (e) {}
}

const loadSyncStatus = async () => {
  try {
    const res = await getSyncStatus()
    const stats = {}
    res.stats.forEach(s => {
      stats[s.status] = s.count
    })
    stats.deadLetterCount = res.deadLetterCount
    syncStats.value = stats
  } catch (e) {}
}

const loadSyncQueue = async () => {
  queueLoading.value = true
  try {
    const params = { pageSize: 50 }
    if (queueStatus.value) params.status = queueStatus.value
    const res = await getSyncQueue(params)
    syncQueue.value = res.list
  } finally {
    queueLoading.value = false
  }
}

const triggerSync = async () => {
  try {
    await triggerSyncApi()
    ElMessage.success('同步已触发')
    loadSyncStatus()
    loadSyncQueue()
  } catch (e) {}
}

const statusText = (status) => {
  const map = {
    pending: '待处理',
    retrying: '重试中',
    success: '成功',
    failed: '失败',
  }
  return map[status] || status
}

const statusTagType = (status) => {
  const map = {
    pending: 'warning',
    retrying: 'primary',
    success: 'success',
    failed: 'danger',
  }
  return map[status] || 'info'
}

const testChannel = (row) => {
  ElMessage.info(`测试 ${row.name} 渠道连接（Mock）`)
}

const pullOrders = async (row) => {
  try {
    const res = await pullChannelOrders(row.code)
    ElMessage.success(`从 ${row.name} 拉取到 ${res.pulled} 条订单`)
  } catch (e) {}
}

const editChannel = (row) => {
  ElMessage.info('渠道配置功能完善中')
}

const retryItem = async (row) => {
  try {
    await retrySync(row.id)
    ElMessage.success('已加入重试队列')
    loadSyncQueue()
    loadSyncStatus()
  } catch (e) {}
}

onMounted(() => {
  loadChannels()
  loadSyncStatus()
  loadSyncQueue()
})
</script>

<style scoped lang="scss">
.channels-page {
  .stats-row {
    margin-bottom: 10px;
    
    :deep(.el-statistic__head) {
      font-size: 14px;
      color: #606266;
    }
    
    :deep(.el-statistic__content) {
      font-size: 24px;
      font-weight: 600;
    }
  }
}
</style>
