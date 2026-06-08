<template>
  <div class="checkout-page">
    <el-card v-if="!currentCheckout">
      <template #header>
        <div class="card-header">
          <span class="card-title">退房结算</span>
        </div>
      </template>
      
      <div class="quick-search">
        <el-form :inline="true" size="default">
          <el-form-item label="选择入住">
            <el-select 
              v-model="selectedCheckinId" 
              placeholder="请输入房号或姓名搜索"
              filterable
              style="width: 320px"
              @change="loadCheckinDetail"
            >
              <el-option
                v-for="item in inHouseList"
                :key="item.id"
                :label="`${item.room_no} - ${item.guest_name}`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
    </el-card>
    
    <div v-if="currentCheckin && !currentCheckout" class="checkout-form">
      <el-row :gutter="16">
        <el-col :span="16">
          <el-card>
            <template #header>
              <span class="card-title">费用明细</span>
            </template>
            
            <div class="guest-info">
              <el-descriptions :column="4" size="small" border>
                <el-descriptions-item label="房号">{{ currentCheckin.room_no }}</el-descriptions-item>
                <el-descriptions-item label="房型">{{ currentCheckin.room_type_name }}</el-descriptions-item>
                <el-descriptions-item label="客人">{{ currentCheckin.guest_name }}</el-descriptions-item>
                <el-descriptions-item label="入住时间">{{ currentCheckin.checkin_time }}</el-descriptions-item>
              </el-descriptions>
            </div>
            
            <el-divider>房费</el-divider>
            <el-table :data="priceDetails" size="small" border>
              <el-table-column prop="date" label="日期" />
              <el-table-column prop="priceType" label="类型" width="100">
                <template #default="{ row }">{{ priceTypeText(row.priceType) }}</template>
              </el-table-column>
              <el-table-column prop="price" label="价格" width="120">
                <template #default="{ row }">¥{{ row.price.toFixed(2) }}</template>
              </el-table-column>
            </el-table>
            
            <el-divider>Mini Bar 消费</el-divider>
            <div class="minibar-section">
              <div class="minibar-quick">
                <span class="label">常用项：</span>
                <el-button 
                  v-for="item in minibarItems" 
                  :key="item.id" 
                  size="small"
                  @click="addMinibarItem(item)"
                >
                  {{ item.name }} ¥{{ item.price }}
                </el-button>
              </div>
              
              <el-table :data="minibarCharges" size="small" border style="margin-top: 12px">
                <el-table-column prop="item_name" label="项目" />
                <el-table-column prop="quantity" label="数量" width="120">
                  <template #default="{ row, $index }">
                    <el-input-number 
                      v-model="row.quantity" 
                      :min="1" 
                      size="small"
                      @change="updateMinibarTotal"
                    />
                  </template>
                </el-table-column>
                <el-table-column prop="unit_price" label="单价" width="100">
                  <template #default="{ row }">¥{{ row.unit_price.toFixed(2) }}</template>
                </el-table-column>
                <el-table-column prop="total_price" label="小计" width="120">
                  <template #default="{ row }">¥{{ row.total_price.toFixed(2) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="80">
                  <template #default="{ $index }">
                    <el-button type="danger" link size="small" @click="removeMinibar($index)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              
              <div class="custom-item" style="margin-top: 10px">
                <el-input 
                  v-model="customItem.name" 
                  placeholder="项目名称" 
                  style="width: 150px; margin-right: 10px"
                  size="small"
                />
                <el-input-number 
                  v-model="customItem.unit_price" 
                  :min="0" 
                  size="small"
                  style="width: 120px; margin-right: 10px"
                />
                <el-button type="primary" size="small" @click="addCustomItem">添加</el-button>
              </div>
            </div>
            
            <el-divider>其他费用</el-divider>
            <div class="extra-charges">
              <el-form :inline="true" size="small">
                <el-form-item label="说明">
                  <el-input v-model="extraForm.description" placeholder="费用说明" style="width: 200px" />
                </el-form-item>
                <el-form-item label="金额">
                  <el-input-number v-model="extraForm.amount" :min="0" size="small" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" size="small" @click="addExtraCharge">添加</el-button>
                </el-form-item>
              </el-form>
              
              <el-table :data="extraCharges" size="small" border style="margin-top: 10px" v-if="extraCharges.length">
                <el-table-column prop="description" label="说明" />
                <el-table-column prop="amount" label="金额" width="150">
                  <template #default="{ row }">¥{{ row.amount.toFixed(2) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="80">
                  <template #default="{ $index }">
                    <el-button type="danger" link size="small" @click="extraCharges.splice($index, 1)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="8">
          <el-card class="summary-card">
            <template #header>
              <span class="card-title">结算汇总</span>
            </template>
            
            <div class="summary-list">
              <div class="summary-item">
                <span class="label">房费合计</span>
                <span class="value">¥{{ roomCharge.toFixed(2) }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Mini Bar</span>
                <span class="value">¥{{ minibarTotal.toFixed(2) }}</span>
              </div>
              <div class="summary-item">
                <span class="label">其他费用</span>
                <span class="value">¥{{ extraTotal.toFixed(2) }}</span>
              </div>
              <div class="summary-item total">
                <span class="label">消费总计</span>
                <span class="value">¥{{ totalCharge.toFixed(2) }}</span>
              </div>
              <el-divider />
              <div class="summary-item">
                <span class="label">已收押金</span>
                <span class="value">¥{{ deposit.toFixed(2) }}</span>
              </div>
              <div class="summary-item refund" v-if="depositRefund > 0">
                <span class="label">应退押金</span>
                <span class="value">¥{{ depositRefund.toFixed(2) }}</span>
              </div>
              <div class="summary-item payable" v-else>
                <span class="label">应补金额</span>
                <span class="value">¥{{ totalPayable.toFixed(2) }}</span>
              </div>
            </div>
            
            <el-form label-width="80px" style="margin-top: 20px">
              <el-form-item label="支付方式">
                <el-select v-model="paymentMethod" style="width: 100%">
                  <el-option label="现金" value="cash" />
                  <el-option label="微信" value="wechat" />
                  <el-option label="支付宝" value="alipay" />
                  <el-option label="银行卡" value="card" />
                </el-select>
              </el-form-item>
              <el-form-item label="备注">
                <el-input type="textarea" v-model="remark" :rows="2" />
              </el-form-item>
            </el-form>
            
            <el-button 
              type="primary" 
              size="large" 
              class="checkout-btn"
              :loading="submitting"
              @click="handleCheckout"
            >
              确认退房
            </el-button>
          </el-card>
        </el-col>
      </el-row>
    </div>
    
    <el-card v-if="currentCheckout">
      <template #header>
        <span class="card-title">退房完成</span>
      </template>
      
      <el-result
        icon="success"
        title="退房成功"
        :sub-title="`退房单号：${currentCheckout.checkout_no}`"
      >
        <template #extra>
          <el-button type="primary" @click="resetPage">继续退房</el-button>
          <el-button @click="goToInvoice">开发票</el-button>
        </template>
      </el-result>
    </el-card>
    
    <el-card style="margin-top: 16px">
      <template #header>
        <span class="card-title">退房记录</span>
      </template>
      
      <el-table :data="checkoutList" v-loading="listLoading" border stripe size="small">
        <el-table-column prop="checkout_no" label="退房单号" width="160" />
        <el-table-column prop="room_no" label="房号" width="80" />
        <el-table-column prop="guest_name" label="客人" width="100" />
        <el-table-column prop="checkout_time" label="退房时间" width="160" />
        <el-table-column prop="room_charge" label="房费" width="100">
          <template #default="{ row }">¥{{ row.room_charge.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="extra_charge" label="其他" width="100">
          <template #default="{ row }">¥{{ row.extra_charge.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="total_payable" label="实收" width="100">
          <template #default="{ row }">¥{{ row.total_payable.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">详情</el-button>
            <el-button type="success" link size="small" @click="goToInvoiceFromCheckout(row)">开票</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  getCheckins,
  getCheckin,
  getMinibarItems,
  calculateCheckout as calcCheckout,
  createCheckout,
  getCheckouts,
  getCheckout,
} from '../api'

const route = useRoute()
const router = useRouter()

const listLoading = ref(false)
const submitting = ref(false)
const inHouseList = ref([])
const selectedCheckinId = ref(null)
const currentCheckin = ref(null)
const currentCheckout = ref(null)
const priceDetails = ref([])
const minibarItems = ref([])
const minibarCharges = ref([])
const extraCharges = ref([])
const checkoutList = ref([])
const paymentMethod = ref('cash')
const remark = ref('')

const customItem = reactive({
  name: '',
  unit_price: 0,
})

const extraForm = reactive({
  description: '',
  amount: 0,
})

const roomCharge = computed(() => {
  return priceDetails.value.reduce((sum, d) => sum + d.price, 0)
})

const minibarTotal = computed(() => {
  return minibarCharges.value.reduce((sum, item) => sum + item.total_price, 0)
})

const extraTotal = computed(() => {
  return extraCharges.value.reduce((sum, item) => sum + item.amount, 0)
})

const totalCharge = computed(() => roomCharge.value + minibarTotal.value + extraTotal.value)

const deposit = computed(() => currentCheckin.value?.deposit || 0)

const depositRefund = computed(() => Math.max(0, deposit.value - totalCharge.value))

const totalPayable = computed(() => Math.max(0, totalCharge.value - deposit.value))

const priceTypeText = (type) => {
  const map = { weekday: '平日', weekend: '周末', holiday: '节假日' }
  return map[type] || type
}

const loadInHouseList = async () => {
  try {
    const res = await getCheckins({ status: 'in_house', pageSize: 100 })
    inHouseList.value = res.list
  } catch (e) {}
}

const loadMinibarItems = async () => {
  try {
    minibarItems.value = await getMinibarItems()
  } catch (e) {}
}

const loadCheckinDetail = async () => {
  if (!selectedCheckinId.value) {
    currentCheckin.value = null
    priceDetails.value = []
    minibarCharges.value = []
    extraCharges.value = []
    return
  }
  
  try {
    const detail = await getCheckin(selectedCheckinId.value)
    currentCheckin.value = detail
    
    const calcRes = await calcCheckout({
      checkin_id: selectedCheckinId.value,
      minibar_items: [],
      extra_charges: [],
    })
    
    priceDetails.value = calcRes.priceDetails
  } catch (e) {}
}

const addMinibarItem = (item) => {
  const existing = minibarCharges.value.find(m => m.item_name === item.name)
  if (existing) {
    existing.quantity++
    existing.total_price = existing.quantity * existing.unit_price
  } else {
    minibarCharges.value.push({
      item_name: item.name,
      quantity: 1,
      unit_price: item.price,
      total_price: item.price,
    })
  }
  updateMinibarTotal()
}

const updateMinibarTotal = () => {
  minibarCharges.value.forEach(item => {
    item.total_price = item.quantity * item.unit_price
  })
}

const removeMinibar = (index) => {
  minibarCharges.value.splice(index, 1)
}

const addCustomItem = () => {
  if (!customItem.name || customItem.unit_price <= 0) {
    ElMessage.warning('请填写项目名称和价格')
    return
  }
  
  minibarCharges.value.push({
    item_name: customItem.name,
    quantity: 1,
    unit_price: customItem.unit_price,
    total_price: customItem.unit_price,
  })
  
  customItem.name = ''
  customItem.unit_price = 0
}

const addExtraCharge = () => {
  if (!extraForm.description || extraForm.amount <= 0) {
    ElMessage.warning('请填写费用说明和金额')
    return
  }
  
  extraCharges.value.push({
    description: extraForm.description,
    amount: extraForm.amount,
  })
  
  extraForm.description = ''
  extraForm.amount = 0
}

const handleCheckout = async () => {
  try {
    await ElMessageBox.confirm(
      `确认退房？${totalPayable.value > 0 ? `应收 ¥${totalPayable.value.toFixed(2)}` : `应退押金 ¥${depositRefund.value.toFixed(2)}`}`,
      '确认退房',
      { type: 'warning' }
    )
    
    submitting.value = true
    
    const res = await createCheckout({
      checkin_id: selectedCheckinId.value,
      minibar_items: minibarCharges.value,
      extra_charges: extraCharges.value,
      payment_method: paymentMethod.value,
      remark: remark.value,
    })
    
    currentCheckout.value = res
    ElMessage.success('退房成功')
    loadCheckoutList()
    loadInHouseList()
  } catch (e) {
    if (e !== 'cancel') {
      // error
    }
  } finally {
    submitting.value = false
  }
}

const resetPage = () => {
  currentCheckout.value = null
  selectedCheckinId.value = null
  currentCheckin.value = null
  priceDetails.value = []
  minibarCharges.value = []
  extraCharges.value = []
  remark.value = ''
  paymentMethod.value = 'cash'
}

const goToInvoice = () => {
  router.push({
    path: '/invoices',
    query: { checkoutId: currentCheckout.value?.id },
  })
}

const goToInvoiceFromCheckout = (row) => {
  router.push({
    path: '/invoices',
    query: { checkoutId: row.id },
  })
}

const viewDetail = async (row) => {
  try {
    await getCheckout(row.id)
    ElMessage.info('详情功能完善中')
  } catch (e) {}
}

const loadCheckoutList = async () => {
  listLoading.value = true
  try {
    const res = await getCheckouts({ pageSize: 20 })
    checkoutList.value = res.list
  } finally {
    listLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadInHouseList(),
    loadMinibarItems(),
    loadCheckoutList(),
  ])
  
  if (route.query.checkinId) {
    selectedCheckinId.value = parseInt(route.query.checkinId)
    loadCheckinDetail()
  }
})
</script>

<style scoped lang="scss">
.checkout-page {
  .quick-search {
    padding: 10px 0;
  }
  
  .checkout-form {
    margin-top: 16px;
  }
  
  .guest-info {
    margin-bottom: 10px;
  }
  
  .minibar-section {
    .minibar-quick {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
      
      .label {
        font-size: 14px;
        color: #606266;
        margin-right: 4px;
      }
    }
  }
  
  .summary-card {
    :deep(.el-card__body) {
      padding: 20px;
    }
  }
  
  .summary-list {
    .summary-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
      
      .label {
        color: #606266;
      }
      
      .value {
        color: #303133;
      }
      
      &.total {
        padding: 12px 0;
        border-top: 1px solid #ebeef5;
        border-bottom: 1px solid #ebeef5;
        margin: 8px 0;
        
        .label {
          font-size: 15px;
          font-weight: 600;
        }
        
        .value {
          font-size: 18px;
          font-weight: 600;
          color: #f56c6c;
        }
      }
      
      &.refund .value {
        color: #67c23a;
        font-weight: 600;
      }
      
      &.payable .value {
        color: #f56c6c;
        font-weight: 600;
      }
    }
  }
  
  .checkout-btn {
    width: 100%;
    margin-top: 10px;
  }
}
</style>
