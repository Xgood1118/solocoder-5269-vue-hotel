<template>
  <div class="invoices-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="card-title">发票管理</span>
          <el-button type="primary" :icon="Plus" @click="handleCreate">开具发票</el-button>
        </div>
      </template>
      
      <div class="filter-bar">
        <el-form :inline="true" :model="filterForm" size="small">
          <el-form-item label="开票日期">
            <el-date-picker
              v-model="filterForm.startDate"
              type="date"
              placeholder="开始"
              value-format="YYYY-MM-DD"
            />
            <span style="margin: 0 6px">至</span>
            <el-date-picker
              v-model="filterForm.endDate"
              type="date"
              placeholder="结束"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item label="搜索">
            <el-input
              v-model="filterForm.keyword"
              placeholder="发票号/抬头"
              clearable
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadInvoices">查询</el-button>
            <el-button @click="resetFilter">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
      
      <el-table :data="invoices" v-loading="loading" border stripe>
        <el-table-column prop="invoice_no" label="发票号码" width="180" />
        <el-table-column prop="invoice_type" label="类型" width="80">
          <template #default="{ row }">
            {{ row.invoice_type === 'personal' ? '个人' : '企业' }}
          </template>
        </el-table-column>
        <el-table-column prop="title" label="发票抬头" show-overflow-tooltip />
        <el-table-column prop="tax_no" label="税号" width="180" show-overflow-tooltip />
        <el-table-column prop="amount" label="金额" width="100">
          <template #default="{ row }">¥{{ row.amount.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="tax_amount" label="税额" width="100">
          <template #default="{ row }">¥{{ row.tax_amount.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="total_amount" label="价税合计" width="120">
          <template #default="{ row }">
            <span class="total-amount">¥{{ row.total_amount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'issued' ? 'success' : 'info'">
              {{ row.status === 'issued' ? '正常' : '已作废' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="invoice_date" label="开票日期" width="160" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handlePreview(row)">预览</el-button>
            <el-button type="success" link size="small" @click="handleDownload(row)">下载</el-button>
            <el-button 
              v-if="row.status === 'issued'"
              type="danger" 
              link 
              size="small"
              @click="handleVoid(row)"
            >
              作废
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
    
    <el-dialog v-model="formVisible" title="开具发票" width="500px" @close="formVisible = false">
      <el-form :model="invoiceForm" :rules="formRules" ref="invoiceFormRef" label-width="100px">
        <el-form-item label="发票类型" prop="invoiceType">
          <el-radio-group v-model="invoiceForm.invoiceType">
            <el-radio value="personal">个人</el-radio>
            <el-radio value="enterprise">企业</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="发票抬头" prop="title">
          <el-input v-model="invoiceForm.title" placeholder="请输入发票抬头" />
        </el-form-item>
        
        <el-form-item 
          v-if="invoiceForm.invoiceType === 'enterprise'" 
          label="税号" 
          prop="taxNo"
        >
          <el-input v-model="invoiceForm.taxNo" placeholder="请输入纳税人识别号" />
        </el-form-item>
        
        <el-form-item label="开票金额" prop="amount">
          <el-input-number 
            v-model="invoiceForm.amount" 
            :min="0" 
            :precision="2"
            style="width: 100%" 
            @change="calculateInvoiceTotal"
          />
        </el-form-item>
        
        <el-form-item label="税率">
          <span>{{ (taxRate * 100).toFixed(0) }}% (服务业增值税)</span>
        </el-form-item>
        
        <el-form-item label="税额">
          <span>¥{{ taxAmount.toFixed(2) }}</span>
        </el-form-item>
        
        <el-form-item label="价税合计">
          <span class="total-amount">¥{{ totalAmount.toFixed(2) }}</span>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确认开票</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="previewVisible" title="发票预览" width="500px">
      <div v-if="previewInvoice" class="invoice-preview">
        <div class="invoice-header">
          <h2>电子发票</h2>
          <p class="subtitle">Electronic Invoice</p>
        </div>
        
        <div class="invoice-body">
          <div class="invoice-row">
            <span class="label">发票号码：</span>
            <span class="value">{{ previewInvoice.invoice_no }}</span>
          </div>
          <div class="invoice-row">
            <span class="label">开票日期：</span>
            <span class="value">{{ previewInvoice.invoice_date }}</span>
          </div>
          <div class="invoice-row">
            <span class="label">发票类型：</span>
            <span class="value">{{ previewInvoice.invoice_type === 'personal' ? '个人' : '企业' }}</span>
          </div>
          <div class="invoice-row">
            <span class="label">购买方：</span>
            <span class="value">{{ previewInvoice.title }}</span>
          </div>
          <div v-if="previewInvoice.tax_no" class="invoice-row">
            <span class="label">税号：</span>
            <span class="value">{{ previewInvoice.tax_no }}</span>
          </div>
          
          <el-divider />
          
          <div class="invoice-table">
            <table>
              <thead>
                <tr>
                  <th>项目</th>
                  <th>金额</th>
                  <th>税率</th>
                  <th>税额</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>住宿服务</td>
                  <td>¥{{ previewInvoice.amount.toFixed(2) }}</td>
                  <td>{{ (previewInvoice.tax_rate * 100).toFixed(0) }}%</td>
                  <td>¥{{ previewInvoice.tax_amount.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="invoice-total">
            <span>价税合计：</span>
            <span class="total">¥{{ previewInvoice.total_amount.toFixed(2) }}</span>
          </div>
        </div>
        
        <div class="invoice-footer">
          <div class="qr-code" v-if="previewInvoice.qr_code">
            <img :src="previewInvoice.qr_code" alt="发票二维码" />
          </div>
          <div class="footer-info">
            <p>开票方：XX 酒店管理有限公司</p>
            <p>税号：XXXXXXXXXXXXXXXXX</p>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getInvoices,
  createInvoice as createInv,
  voidInvoice as voidInv,
  calculateInvoice as calcInvoice,
  getTaxRate,
} from '../api'

const route = useRoute()

const loading = ref(false)
const invoices = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const taxRate = ref(0.06)

const filterForm = reactive({
  startDate: '',
  endDate: '',
  keyword: '',
})

const formVisible = ref(false)
const previewVisible = ref(false)
const submitting = ref(false)
const previewInvoice = ref(null)
const invoiceFormRef = ref(null)

const invoiceForm = reactive({
  checkoutId: null,
  bookingId: null,
  invoiceType: 'personal',
  title: '',
  taxNo: '',
  amount: 0,
})

const formRules = {
  title: [{ required: true, message: '请输入发票抬头', trigger: 'blur' }],
  amount: [{ required: true, message: '请输入开票金额', trigger: 'change' }],
}

const taxAmount = computed(() => {
  return parseFloat((invoiceForm.amount * taxRate.value).toFixed(2))
})

const totalAmount = computed(() => {
  return parseFloat((invoiceForm.amount + taxAmount.value).toFixed(2))
})

const loadInvoices = async () => {
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
    const res = await getInvoices(params)
    invoices.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const resetFilter = () => {
  filterForm.startDate = ''
  filterForm.endDate = ''
  filterForm.keyword = ''
  currentPage.value = 1
  loadInvoices()
}

const handlePageChange = (page) => {
  currentPage.value = page
  loadInvoices()
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
  loadInvoices()
}

const handleCreate = () => {
  invoiceForm.invoiceType = 'personal'
  invoiceForm.title = ''
  invoiceForm.taxNo = ''
  invoiceForm.amount = 0
  invoiceForm.checkoutId = route.query.checkoutId ? parseInt(route.query.checkoutId) : null
  formVisible.value = true
}

const calculateInvoiceTotal = async () => {
  if (invoiceForm.amount > 0) {
    try {
      const res = await calcInvoice({ amount: invoiceForm.amount })
      taxRate.value = res.taxRate
    } catch (e) {}
  }
}

const handleSubmit = async () => {
  await invoiceFormRef.value.validate()
  submitting.value = true
  try {
    await createInv(invoiceForm)
    ElMessage.success('发票开具成功')
    formVisible.value = false
    loadInvoices()
  } finally {
    submitting.value = false
  }
}

const handlePreview = (row) => {
  previewInvoice.value = row
  previewVisible.value = true
}

const handleDownload = (row) => {
  ElMessage.info('发票下载功能完善中')
}

const handleVoid = async (row) => {
  try {
    await ElMessageBox.confirm('确定要作废此发票吗？', '提示', {
      type: 'warning',
    })
    await voidInv(row.id)
    ElMessage.success('发票已作废')
    loadInvoices()
  } catch (e) {
    // cancelled
  }
}

onMounted(async () => {
  try {
    const res = await getTaxRate()
    taxRate.value = res.taxRate
  } catch (e) {}
  
  loadInvoices()
  
  if (route.query.checkoutId) {
    handleCreate()
  }
})
</script>

<style scoped lang="scss">
.invoices-page {
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
  
  .total-amount {
    color: #f56c6c;
    font-weight: 600;
  }
  
  .invoice-preview {
    background: white;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    padding: 24px;
    
    .invoice-header {
      text-align: center;
      border-bottom: 2px solid #409eff;
      padding-bottom: 16px;
      margin-bottom: 20px;
      
      h2 {
        font-size: 24px;
        color: #303133;
        margin: 0;
      }
      
      .subtitle {
        color: #909399;
        font-size: 12px;
        margin-top: 4px;
      }
    }
    
    .invoice-body {
      .invoice-row {
        display: flex;
        padding: 6px 0;
        
        .label {
          width: 100px;
          color: #606266;
        }
        
        .value {
          flex: 1;
          color: #303133;
        }
      }
      
      .invoice-table {
        margin: 16px 0;
        
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          
          th, td {
            border: 1px solid #ebeef5;
            padding: 8px;
            text-align: center;
          }
          
          th {
            background: #f5f7fa;
            font-weight: 600;
          }
        }
      }
      
      .invoice-total {
        text-align: right;
        font-size: 16px;
        font-weight: 600;
        margin-top: 16px;
        
        .total {
          color: #f56c6c;
          font-size: 20px;
        }
      }
    }
    
    .invoice-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px dashed #dcdfe6;
      
      .qr-code {
        img {
          width: 100px;
          height: 100px;
        }
      }
      
      .footer-info {
        text-align: right;
        font-size: 12px;
        color: #909399;
        line-height: 1.8;
      }
    }
  }
}
</style>
