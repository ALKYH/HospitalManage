<template>
  <div class='panel'>
    <h3>订单管理</h3>
    
    <!-- 筛选栏 -->
    <el-card shadow="never" style="margin-bottom: 20px;">
      <el-form :inline="true" :model="orders" class="demo-form-inline">
        <el-form-item label="医生">
          <el-select v-model="orders.filterDoctorId" placeholder="全部医生" clearable style="width: 180px">
            <el-option
              v-for="d in doctors"
              :key="d.id"
              :label="d.name"
              :value="String(d.id)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="orders.filterDate"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="orders.filterStatus" placeholder="全部状态" clearable style="width: 150px">
            <el-option label="Pending" value="pending" />
            <el-option label="Confirmed" value="confirmed" />
            <el-option label="Waiting" value="waiting" />
            <el-option label="Cancelled" value="cancelled" />
            <el-option label="Completed" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="$emit('refresh')" :icon="Search">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 订单列表 -->
    <el-table :data="orders.list" stripe style="width: 100%" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="account_id" label="账户ID" width="100" />
      <el-table-column label="医生">
        <template #default="scope">
          {{ scope.row.doctor_name || scope.row.doctor_id }}
        </template>
      </el-table-column>
      <el-table-column prop="department_name" label="科室" />
      <el-table-column prop="date" label="日期" sortable width="120" />
      <el-table-column prop="slot" label="时段" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="scope">
          <el-tag :type="getStatusType(scope.row.status)">{{ scope.row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="候补信息" width="120">
        <template #default="scope">
          <span v-if="scope.row.is_waitlist">
            Pos: {{ (scope.row.wait_position||0)+1 }} / {{ scope.row.wait_total||0 }}
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="payment_amount" label="支付金额" width="100" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="scope">
          <el-button 
            v-if="scope.row.status !== 'cancelled' && scope.row.status !== 'completed'"
            type="danger" 
            size="small" 
            @click="$emit('cancel-order', scope.row.id)"
          >
            取消
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无订单数据" />
      </template>
    </el-table>
  </div>
</template>

<script setup>
import { Search } from '@element-plus/icons-vue'

defineProps({
  orders: { type: Object, required: true },
  doctors: { type: Array, default: () => [] }
})

defineEmits(['refresh', 'cancel-order'])

const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    confirmed: 'success',
    waiting: 'info',
    cancelled: 'danger',
    completed: ''
  }
  return map[status] || 'info'
}
</script>
