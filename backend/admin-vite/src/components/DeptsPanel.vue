<template>
  <div class='panel'>
    <h3>科室管理</h3>
    
    <!-- 顶部工具栏 -->
    <div class="toolbar" style="margin-bottom: 20px;">
      <el-radio-group v-model="localSubTab" @change="handleTabChange">
        <el-radio-button label="list">查看科室</el-radio-button>
        <el-radio-button label="create">创建科室</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 科室列表 -->
    <div v-if="localSubTab === 'list'">
      <el-alert
        title="科室列表 — 可以删除已有科室。删除将会删除与之直接关联的数据，请谨慎操作。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom: 16px;"
      />
      
      <el-table :data="depts" stripe style="width: 100%" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="名称" />
        <el-table-column label="父科室">
          <template #default="scope">
            {{ findDeptName(scope.row.parent_id) || '无' }}
          </template>
        </el-table-column>
        <el-table-column prop="code" label="Code">
          <template #default="scope">
            {{ scope.row.code || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button 
              type="danger" 
              size="small" 
              :icon="Delete"
              @click="handleDelete(scope.row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无科室数据" />
        </template>
      </el-table>
    </div>

    <!-- 创建科室表单 -->
    <div v-if="localSubTab === 'create'" style="max-width: 500px; margin-top: 20px;">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>创建新科室</span>
          </div>
        </template>
        
        <el-form :model="deptForm" label-width="100px">
          <el-form-item label="科室名" required>
            <el-input v-model.trim="deptForm.name" placeholder="请输入科室名称" />
          </el-form-item>
          
          <el-form-item label="Code">
            <el-input v-model.trim="deptForm.code" placeholder="可选，如 internal-med" />
          </el-form-item>
          
          <el-form-item label="父科室">
            <el-select v-model="deptForm.parent_id" placeholder="选择父科室（可选）" clearable style="width: 100%">
              <el-option
                v-for="d in depts"
                :key="d.id"
                :label="d.name"
                :value="d.id"
              />
            </el-select>
          </el-form-item>
          
          <el-form-item>
            <el-button type="primary" @click="$emit('create-dept')">立即创建</el-button>
            <el-button @click="localSubTab = 'list'; handleTabChange('list')">取消</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'

const props = defineProps({
  depts: { type: Array, default: () => [] },
  deptForm: { type: Object, required: true },
  deptsSubTab: { type: String, default: 'list' },
  findDeptName: { type: Function, required: true }
})

const emit = defineEmits(['update:depts-sub-tab', 'create-dept', 'delete-dept'])

const localSubTab = ref(props.deptsSubTab)

watch(() => props.deptsSubTab, (val) => {
  localSubTab.value = val
})

const handleTabChange = (val) => {
  emit('update:depts-sub-tab', val)
}

const handleDelete = (id) => {
  ElMessageBox.confirm(
    '确认删除该科室吗？此操作将删除与之关联的所有数据，且不可恢复。',
    '警告',
    {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
    }
  )
    .then(() => {
      emit('delete-dept', id)
    })
    .catch(() => {
      // cancel
    })
}
</script>

<style scoped>
/* 覆盖一些 Pico.css 可能造成的冲突，或者补充样式 */
.toolbar {
  display: flex;
  align-items: center;
}
</style>
