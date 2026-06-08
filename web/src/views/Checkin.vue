<template>
  <div class="checkin-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="card-title">入住管理</span>
          <el-button type="primary" :icon="Plus" @click="handleCreate">散客入住</el-button>
        </div>
      </template>
      
      <div class="filter-bar">
        <el-form :inline="true" :model="filterForm" size="small">
          <el-form-item label="状态">
            <el-select v-model="filterForm.status" placeholder="全部" clearable style="width: 120px">
              <el-option label="在住" value="in_house" />
              <el-option label="已退房" value="checked_out" />
            </el-select>
          </el-form-item>
          <el-form-item label="搜索">
            <el-input
              v-model="filterForm.keyword"
              placeholder="姓名/房号/身份证"
              clearable
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadCheckins">查询</el-button>
            <el-button @click="resetFilter">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
      
      <el-table :data="checkins" v-loading="loading" border stripe>
        <el-table-column prop="checkin_no" label="入住单号" width="140" />
        <el-table-column prop="room_no" label="房号" width="70" />
        <el-table-column prop="room_type_name" label="房型" width="90" />
        <el-table-column prop="guest_name" label="客人姓名" width="90" />
        <el-table-column prop="id_card" label="身份证号" width="160" />
        <el-table-column prop="checkin_time" label="入住时间" width="160" />
        <el-table-column prop="expected_checkout" label="预计退房" width="110" />
        <el-table-column prop="deposit" label="押金" width="90">
          <template #default="{ row }">¥{{ row.deposit.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="room_card_no" label="房卡号" width="90" />
        <el-table-column prop="booking_no" label="预订号" width="140" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">详情</el-button>
            <el-button 
              v-if="row.status === 'in_house'" 
              type="success" 
              link 
              size="small"
              @click="handleAddDeposit(row)"
            >
              加押金
            </el-button>
            <el-button 
              v-if="row.status === 'in_house'" 
              type="warning" 
              link 
              size="small"
              @click="handleCheckout(row)"
            >
              退房
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 50]"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
    
    <el-dialog v-model="formVisible" :title="formTitle" width="560px" @close="formVisible = false">
      <el-form :model="checkinForm" :rules="formRules" ref="checkinFormRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="选择房间" prop="room_id">
              <el-select 
                v-model="checkinForm.room_id" 
                style="width: 100%"
                @change="onRoomChange"
              >
                <el-option-group 
                  v-for="rt in roomTypes" 
                  :key="rt.id" 
                  :label="rt.name"
                >
                  <el-option 
                    v-for="room in availableRooms.filter(r => r.room_type_id === rt.id)" 
                    :key="room.id"
                    :label="room.room_no"
                    :value="room.id"
                  />
                </el-option-group>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="预计退房">
              <el-date-picker
                v-model="checkinForm.expected_checkout"
                type="date"
                style="width: 100%"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="14">
            <el-form-item label="客人姓名" prop="guest_name">
              <el-input v-model="checkinForm.guest_name" />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="身份证号" prop="id_card">
              <el-input v-model="checkinForm.id_card" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="身份证核验">
          <el-button size="small" type="primary" :loading="verifying" @click="verifyIdCard">
            验证身份
          </el-button>
          <span v-if="verifyResult" class="verify-result" :class="verifyResult.valid ? 'success' : 'error'">
            {{ verifyResult.message }}
          </span>
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="checkinForm.guest_phone" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="房卡号">
              <el-input v-model="checkinForm.room_card_no" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="押金金额" prop="deposit">
              <el-input-number 
                v-model="checkinForm.deposit" 
                :min="0" 
                :step="100"
                style="width: 100%" 
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="支付方式">
              <el-select v-model="checkinForm.payment_method" style="width: 100%">
                <el-option label="现金" value="cash" />
                <el-option label="微信" value="wechat" />
                <el-option label="支付宝" value="alipay" />
                <el-option label="银行卡" value="card" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确认入住</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="depositVisible" title="追加押金" width="400px">
      <el-form :model="depositForm" label-width="100px">
        <el-form-item label="押金金额">
          <el-input-number 
            v-model="depositForm.amount" 
            :min="0" 
            :step="100"
            style="width: 100%" 
          />
        </el-form-item>
        <el-form-item label="支付方式">
          <el-select v-model="depositForm.payment_method" style="width: 100%">
            <el-option label="现金" value="cash" />
            <el-option label="微信" value="wechat" />
            <el-option label="支付宝" value="alipay" />
            <el-option label="银行卡" value="card" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input type="textarea" v-model="depositForm.remark" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="depositVisible = false">取消</el-button>
        <el-button type="primary" :loading="depositSubmitting" @click="submitDeposit">确认</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="detailVisible" title="入住详情" width="560px">
      <div v-if="currentCheckin" class="detail-content">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="入住单号">{{ currentCheckin.checkin_no }}</el-descriptions-item>
          <el-descriptions-item label="预订号">{{ currentCheckin.booking_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="房号">{{ currentCheckin.room_no }}</el-descriptions-item>
          <el-descriptions-item label="房型">{{ currentCheckin.room_type_name }}</el-descriptions-item>
          <el-descriptions-item label="客人姓名">{{ currentCheckin.guest_name }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ currentCheckin.guest_phone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="身份证号">{{ currentCheckin.id_card || '-' }}</el-descriptions-item>
          <el-descriptions-item label="房卡号">{{ currentCheckin.room_card_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="入住时间">{{ currentCheckin.checkin_time }}</el-descriptions-item>
          <el-descriptions-item label="预计退房">{{ currentCheckin.expected_checkout || '-' }}</el-descriptions-item>
          <el-descriptions-item label="押金总额">¥{{ currentCheckin.deposit.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentCheckin.status === 'in_house' ? 'success' : 'info'">
              {{ currentCheckin.status === 'in_house' ? '在住' : '已退房' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
        
        <el-divider>押金流水</el-divider>
        <el-table :data="currentCheckin.deposits || []" size="small" border>
          <el-table-column prop="type" label="类型" width="80">
            <template #default="{ row }">{{ row.type === 'deposit' ? '收取' : '退还' }}</template>
          </el-table-column>
          <el-table-column prop="amount" label="金额" width="100">
            <template #default="{ row }">
              <span :class="{ negative: row.amount < 0 }">{{ row.amount > 0 ? '+' : '' }}¥{{ Math.abs(row.amount).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="payment_method" label="支付方式" width="100">
            <template #default="{ row }">{{ paymentMethodText(row.payment_method) }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" />
          <el-table-column prop="created_at" label="时间" width="160" />
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getCheckins,
  getCheckin,
  createCheckin,
  verifyIdCard as verifyId,
  addDeposit,
  getRooms,
  getRoomTypes,
} from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const checkins = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const roomTypes = ref([])
const availableRooms = ref([])

const filterForm = reactive({
  status: 'in_house',
  keyword: '',
})

const formVisible = ref(false)
const detailVisible = ref(false)
const depositVisible = ref(false)
const submitting = ref(false)
const verifying = ref(false)
const depositSubmitting = ref(false)
const verifyResult = ref(null)
const currentCheckin = ref(null)
const checkinFormRef = ref(null)

const bookingId = ref(null)

const checkinForm = reactive({
  booking_id: null,
  room_id: null,
  guest_name: '',
  guest_phone: '',
  id_card: '',
  expected_checkout: '',
  deposit: 200,
  room_card_no: '',
  payment_method: 'cash',
})

const depositForm = reactive({
  checkin_id: null,
  amount: 0,
  payment_method: 'cash',
  remark: '',
})

const formRules = {
  room_id: [{ required: true, message: '请选择房间', trigger: 'change' }],
  guest_name: [{ required: true, message: '请输入客人姓名', trigger: 'blur' }],
}

const formTitle = computed(() => bookingId.value ? '预订入住' : '散客入住')

const paymentMethodText = (method) => {
  const map = { cash: '现金', wechat: '微信', alipay: '支付宝', card: '银行卡' }
  return map[method] || method
}

const loadCheckins = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
      ...filterForm,
    }
    Object.keys(params).forEach(key => {
      if (!params[key] && params[key] !== 0) delete params[key]
    })
    const res = await getCheckins(params)
    checkins.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const resetFilter = () => {
  filterForm.status = 'in_house'
  filterForm.keyword = ''
  currentPage.value = 1
  loadCheckins()
}

const handlePageChange = (page) => {
  currentPage.value = page
  loadCheckins()
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
  loadCheckins()
}

const handleCreate = () => {
  bookingId.value = null
  Object.keys(checkinForm).forEach(key => {
    if (key === 'deposit') checkinForm[key] = 200
    else if (key === 'payment_method') checkinForm[key] = 'cash'
    else checkinForm[key] = ''
  })
  checkinForm.booking_id = null
  checkinForm.room_id = null
  verifyResult.value = null
  loadAvailableRooms()
  formVisible.value = true
}

const loadAvailableRooms = async () => {
  try {
    const res = await getRooms({ status: 'available' })
    availableRooms.value = res
  } catch (e) {}
}

const onRoomChange = () => {
}

const verifyIdCard = async () => {
  if (!checkinForm.id_card || !checkinForm.guest_name) {
    ElMessage.warning('请先输入姓名和身份证号')
    return
  }
  verifying.value = true
  try {
    const res = await verifyId({
      id_card: checkinForm.id_card,
      name: checkinForm.guest_name,
    })
    verifyResult.value = res
  } finally {
    verifying.value = false
  }
}

const handleSubmit = async () => {
  await checkinFormRef.value.validate()
  submitting.value = true
  try {
    await createCheckin(checkinForm)
    ElMessage.success('入住登记成功')
    formVisible.value = false
    loadCheckins()
  } finally {
    submitting.value = false
  }
}

const handleView = async (row) => {
  try {
    const res = await getCheckin(row.id)
    currentCheckin.value = res
    detailVisible.value = true
  } catch (e) {}
}

const handleAddDeposit = (row) => {
  depositForm.checkin_id = row.id
  depositForm.amount = 0
  depositForm.remark = ''
  depositForm.payment_method = 'cash'
  depositVisible.value = true
}

const submitDeposit = async () => {
  if (!depositForm.amount || depositForm.amount <= 0) {
    ElMessage.warning('请输入押金金额')
    return
  }
  depositSubmitting.value = true
  try {
    await addDeposit(depositForm.checkin_id, {
      amount: depositForm.amount,
      payment_method: depositForm.payment_method,
      remark: depositForm.remark,
    })
    ElMessage.success('押金追加成功')
    depositVisible.value = false
    loadCheckins()
  } finally {
    depositSubmitting.value = false
  }
}

const handleCheckout = (row) => {
  router.push({
    path: '/checkout',
    query: { checkinId: row.id },
  })
}

onMounted(async () => {
  await loadRoomTypes()
  loadCheckins()
  
  if (route.query.bookingId) {
    bookingId.value = route.query.bookingId
    checkinForm.booking_id = parseInt(route.query.bookingId)
    loadAvailableRooms()
    formVisible.value = true
  }
})

const loadRoomTypes = async () => {
  try {
    roomTypes.value = await getRoomTypes()
  } catch (e) {}
}
</script>

<style scoped lang="scss">
.checkin-page {
  .filter-bar {
    margin-bottom: 16px;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
  }
  
  .pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
  
  .verify-result {
    margin-left: 10px;
    font-size: 13px;
    
    &.success {
      color: #67c23a;
    }
    
    &.error {
      color: #f56c6c;
    }
  }
  
  .detail-content {
    .negative {
      color: #f56c6c;
    }
  }
}
</style>
