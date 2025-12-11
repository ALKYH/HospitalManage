<template>
  <div class='panel'>
    <h3>医生管理</h3>
    
    <div class="toolbar" style="margin-bottom: 20px;">
      <el-radio-group v-model="localSubTab" @change="handleTabChange">
        <el-radio-button label="list">查看医生</el-radio-button>
        <el-radio-button label="create">创建医生</el-radio-button>
      </el-radio-group>
    </div>

    <div v-if="localSubTab === 'list'">
      <el-alert
        title="医生按科室分组，添加医生时请选择其所属科室。表格支持删除医生。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom: 16px;"
      />
      
      <el-table :data="doctors" stripe style="width: 100%" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="title" label="职称" width="120" />
        <el-table-column label="科室" width="150">
          <template #default="scope">
            <el-tag size="small">{{ findDeptName(scope.row.department_id) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="contact" label="联系方式" />
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button 
              size="small" 
              @click="$emit('set-doctor-pwd', scope.row.id)"
            >
              重置密码
            </el-button>
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
          <el-empty description="暂无医生数据" />
        </template>
      </el-table>
    </div>

    <div v-if="localSubTab === 'create'" style="max-width: 600px; margin-top: 20px;">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>创建新医生</span>
          </div>
        </template>
        
        <el-form :model="doctorForm" label-width="100px">
          <el-form-item label="姓名" required>
            <el-input v-model.trim="doctorForm.name" placeholder="医生姓名" />
          </el-form-item>
          
          <el-form-item label="职称">
            <el-input v-model.trim="doctorForm.title" placeholder="如：主任医师" />
          </el-form-item>
          
          <el-form-item label="联系方式">
            <el-input v-model.trim="doctorForm.contact" placeholder="电话或邮箱" />
          </el-form-item>
          
          <el-form-item label="所属科室" required>
            <el-select v-model="doctorForm.department_id" placeholder="请选择科室" style="width: 100%">
              <el-option
                v-for="d in depts"
                :key="d.id"
                :label="d.name"
                :value="d.id"
              />
            </el-select>
          </el-form-item>
          
          <el-form-item>
            <el-button type="primary" @click="$emit('create-doctor')">立即创建</el-button>
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
  doctors: { type: Array, default: () => [] },
  depts: { type: Array, default: () => [] },
  doctorForm: { type: Object, required: true },
  doctorsSubTab: { type: String, default: 'list' },
  findDeptName: { type: Function, required: true }
})

const emit = defineEmits(['update:doctors-sub-tab', 'create-doctor', 'delete-doctor', 'set-doctor-pwd'])

const localSubTab = ref(props.doctorsSubTab)

watch(() => props.doctorsSubTab, (val) => {
  localSubTab.value = val
})

const handleTabChange = (val) => {
  emit('update:doctors-sub-tab', val)
}

const handleDelete = (id) => {
  emit('delete-doctor', id)
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
}
</style>
