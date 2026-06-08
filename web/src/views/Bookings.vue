<template>
  <div class="bookings-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="card-title">预订管理</span>
          <el-button type="primary" :icon="Plus" @click="handleCreate">新增预订</el-button>
        </div>
      </template>
      
      <div class="filter-bar">
        <el-form :inline="true" :model="filterForm" size="small">
          <el-form-item label="状态">
            <el-select v-model="filterForm.status" placeholder="全部" clearable style="width: 120px">
              <el-option label="已确认" value="confirmed" />
              <el-option label="已入住" value="checked_in" />
              <el-option label="已退房" value="checked_out" />
              <el-option label="已取消" value="cancelled" />
              <el-option label="未入住" value="no_show" />
            </el-select>
          </el-form-item>
          <el-form-item label="渠道">
            <el-select v-model="filterForm.channel" placeholder="全部" clearable style="width: 120px">
              <el-option label="直营" value="direct" />
              <el-option label="携程" value="ctrip" />
              <el-option label="美团" value="meituan" />
              <el-option label="飞猪" value="fliggy" />
            </el-select>
          </el-form-item>
          <el-form-item label="入住日期">
            <el-date-picker
              v-model="filterForm.start_date"
              type="date"
              placeholder="开始日期"
              value-format="YYYY-MM-DD"
            />
            <span style="margin: 0 6px">至</span>
            <el-date-picker
              v-model="filterForm.end_date"
              type="date"
              placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item label="搜索">
            <el-input
              v-model="filterForm.keyword"
              placeholder="姓名/订单号"
              clearable
              style="width: 180px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadBookings">查询</el-button>
            <el-button @click="resetFilter">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
      
      <el-table :data="bookings" v-loading="loading" border stripe>
        <el-table-column prop="booking_no" label="预订号" width="160" />
        <el-table-column prop="channel" label="渠道" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="channelTagType(row.channel)">
              {{ channelName(row.channel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="room_type_name" label="房型" width="100" />
        <el-table-column prop="room_no" label="房号" width="80" />
        <el-table-column prop="guest_name" label="客人姓名" width="100" />
        <el-table-column prop="guest_phone" label="联系电话" width="120" />
        <el-table-column prop="checkin_date" label="入住" width="110" />
        <el-table-column prop="checkout_date" label="退房" width="110" />
        <el-table-column prop="nights" label="晚数" width="60" align="center" />
        <el-table-column prop="total_price" label="总价" width="100">
          <template #default="{ row }">¥{{ row.total_price.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">详情</el-button>
            <el-button 
              v-if="row.status === 'confirmed'" 
              type="success" 
              link 
              size="small"
              @click="handleCheckin(row)"
            >
              入住
            </el-button>
            <el-button 
              v-if="row.status === 'confirmed'" 
              type="danger" 
              link 
              size="small"
              @click="handleCancel(row)"
            >
              取消
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
          :page-sizes="[10, 20, 50, 100]"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
    
    <el-dialog v-model="formVisible" title="新增预订" width="600px" @close="formVisible = false">
      <el-form :model="bookingForm" :rules="formRules" ref="bookingFormRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="渠道" prop="channel">
              <el-select v-model="bookingForm.channel" style="width: 100%">
                <el-option label="直营" value="direct" />
                <el-option label="携程" value="ctrip" />
                <el-option label="美团" value="meituan" />
                <el-option label="飞猪" value="fliggy" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="房型" prop="room_type_id">
              <el-select v-model="bookingForm.room_type_id" style="width: 100%" @change="calculatePrice">
                <el-option 
                  v-for="rt in roomTypes" 
                  :key="rt.id" 
                  :label="rt.name" 
                  :value="rt.id" 
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="入住日期" prop="checkin_date">
              <el-date-picker
                v-model="bookingForm.checkin_date"
                type="date"
                style="width: 100%"
                value-format="YYYY-MM-DD"
                @change="calculatePrice"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="退房日期" prop="checkout_date">
              <el-date-picker
                v-model="bookingForm.checkout_date"
                type="date"
                style="width: 100%"
                value-format="YYYY-MM-DD"
                @change="calculatePrice"
              />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="客人姓名" prop="guest_name">
              <el-input v-model="bookingForm.guest_name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" prop="guest_phone">
              <el-input v-model="bookingForm.guest_phone" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="身份证号">
              <el-input v-model="bookingForm.id_card" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="晚数">
              <el-input :value="priceResult.nights || 0" disabled />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="总价">
          <span class="price-total">¥{{ (priceResult.totalPrice || 0).toFixed(2) }}</span>
          <el-tag v-if="priceResult.details" size="small" type="info" style="margin-left: 10px">
            平日/周末/节假日自动计算
          </el-tag>
        </el-form-item>
        
        <el-form-item label="备注">
          <el-input type="textarea" v-model="bookingForm.remark" :rows="2" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确认预订</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="detailVisible" title="预订详情" width="560px">
      <div v-if="currentBooking" class="booking-detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="预订号">{{ currentBooking.booking_no }}</el-descriptions-item>
          <el-descriptions-item label="渠道">
            {{ channelName(currentBooking.channel) }}
          </el-descriptions-item>
          <el-descriptions-item label="房型">{{ currentBooking.room_type_name }}</el-descriptions-item>
          <el-descriptions-item label="房号">{{ currentBooking.room_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客人姓名">{{ currentBooking.guest_name }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ currentBooking.guest_phone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="入住日期">{{ currentBooking.checkin_date }}</el-descriptions-item>
          <el-descriptions-item label="退房日期">{{ currentBooking.checkout_date }}</el-descriptions-item>
          <el-descriptions-item label="晚数">{{ currentBooking.nights }} 晚</el-descriptions-item>
          <el-descriptions-item label="总价">¥{{ currentBooking.total_price.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(currentBooking.status)">
              {{ statusText(currentBooking.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="渠道订单号">{{ currentBooking.channel_order_no || '-' }}</el-descriptions-item>
        </el-descriptions>
        
        <el-divider>房价明细</el-divider>
        
        <el-table :data="currentBooking.priceDetails || []" size="small" border>
          <el-table-column prop="date" label="日期" />
          <el-table-column prop="price_type" label="类型" width="80">
            <template #default="{ row }">{{ priceTypeText(row.price_type) }}</template>
          </el-table-column>
          <el-table-column prop="price" label="价格" width="100">
            <template #default="{ row }">¥{{ row.price.toFixed(2) }}</template>
          </el-table-column>
        </el-table>
        
        <div v-if="currentBooking.remark" class="remark-box">
          <div class="remark-label">备注：</div>
          <div class="remark-content">{{ currentBooking.remark }}</div>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { 
  getBookings, 
  getBooking, 
  createBooking, 
  updateBookingStatus,
  calculatePrice as calcPrice,
  getRoomTypes,
} from '../api'

const router = useRouter()

const loading = ref(false)
const bookings = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const roomTypes = ref([])

const filterForm = reactive({
  status: '',
  channel: '',
  start_date: '',
  end_date: '',
  keyword: '',
})

const formVisible = ref(false)
const detailVisible = ref(false)
const submitting = ref(false)
const currentBooking = ref(null)
const priceResult = ref({})
const bookingFormRef = ref(null)

const bookingForm = reactive({
  channel: 'direct',
  room_type_id: null,
  checkin_date: '',
  checkout_date: '',
  guest_name: '',
  guest_phone: '',
  id_card: '',
  remark: '',
})

const formRules = {
  room_type_id: [{ required: true, message: '请选择房型', trigger: 'change' }],
  checkin_date: [{ required: true, message: '请选择入住日期', trigger: 'change' }],
  checkout_date: [{ required: true, message: '请选择退房日期', trigger: 'change' }],
  guest_name: [{ required: true, message: '请输入客人姓名', trigger: 'blur' }],
}

const channelName = (channel) => {
  const map = { direct: '直营', ctrip: '携程', meituan: '美团', fliggy: '飞猪' }
  return map[channel] || channel
}

const channelTagType = (channel) => {
  const map = { direct: '', ctrip: 'primary', meituan: 'success', fliggy: 'warning' }
  return map[channel] || 'info'
}

const statusText = (status) => {
  const map = {
    confirmed: '已确认',
    checked_in: '已入住',
    checked_out: '已退房',
    cancelled: '已取消',
    no_show: '未入住',
  }
  return map[status] || status
}

const statusTagType = (status) => {
  const map = {
    confirmed: 'primary',
    checked_in: 'success',
    checked_out: 'info',
    cancelled: 'info',
    no_show: 'danger',
  }
  return map[status] || 'info'
}

const priceTypeText = (type) => {
  const map = { weekday: '平日', weekend: '周末', holiday: '节假日' }
  return map[type] || type
}

const loadBookings = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
      ...filterForm,
    }
    Object.keys(params).forEach(key => {
      if (!params[key]) delete params[key]
    })
    const res = await getBookings(params)
    bookings.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const resetFilter = () => {
  filterForm.status = ''
  filterForm.channel = ''
  filterForm.start_date = ''
  filterForm.end_date = ''
  filterForm.keyword = ''
  currentPage.value = 1
  loadBookings()
}

const handlePageChange = (page) => {
  currentPage.value = page
  loadBookings()
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
  loadBookings()
}

const handleCreate = () => {
  Object.keys(bookingForm).forEach(key => {
    bookingForm[key] = key === 'channel' ? 'direct' : ''
  })
  bookingForm.room_type_id = null
  priceResult.value = {}
  formVisible.value = true
}

const calculatePrice = async () => {
  if (bookingForm.room_type_id && bookingForm.checkin_date && bookingForm.checkout_date) {
    try {
      const res = await calcPrice({
        room_type_id: bookingForm.room_type_id,
        checkin_date: bookingForm.checkin_date,
        checkout_date: bookingForm.checkout_date,
      })
      priceResult.value = res
    } catch (e) {
      priceResult.value = {}
    }
  }
}

const handleSubmit = async () => {
  await bookingFormRef.value.validate()
  submitting.value = true
  try {
    await createBooking(bookingForm)
    ElMessage.success('预订成功')
    formVisible.value = false
    loadBookings()
  } finally {
    submitting.value = false
  }
}

const handleView = async (row) => {
  try {
    const res = await getBooking(row.id)
    currentBooking.value = res
    detailVisible.value = true
  } catch (e) {}
}

const handleCheckin = (row) => {
  router.push({
    path: '/checkin',
    query: { bookingId: row.id },
  })
}

const handleCancel = async (row) => {
  try {
    await ElMessageBox.confirm('确定要取消此预订吗？', '提示', {
      type: 'warning',
    })
    await updateBookingStatus(row.id, 'cancelled')
    ElMessage.success('预订已取消')
    loadBookings()
  } catch (e) {
    // cancelled
  }
}

onMounted(async () => {
  await loadRoomTypes()
  loadBookings()
})

const loadRoomTypes = async () => {
  try {
    roomTypes.value = await getRoomTypes()
  } catch (e) {}
}
</script>

<style scoped lang="scss">
.bookings-page {
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
  
  .price-total {
    font-size: 20px;
    font-weight: 600;
    color: #f56c6c;
  }
  
  .booking-detail {
    .remark-box {
      margin-top: 16px;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 4px;
      
      .remark-label {
        font-weight: 600;
        margin-bottom: 4px;
      }
      
      .remark-content {
        color: #606266;
      }
    }
  }
}
</style>
