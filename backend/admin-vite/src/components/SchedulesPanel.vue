<template>
  <div class='panel'>
    <h3>排班与号源设置</h3>
    
    <div class="toolbar" style="margin-bottom: 20px;">
      <el-radio-group v-model="localSubTab" @change="handleTabChange">
        <el-radio-button label="schedule">排班设置</el-radio-button>
        <el-radio-button label="sources">已发布号源</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 排班设置 -->
    <div v-if="localSubTab === 'schedule'">
      <el-alert
        title="操作指引：先选择科室和医生，然后选择日期和时段，最后设置各号别的容量并保存。"
        type="success"
        :closable="false"
        style="margin-bottom: 20px;"
      />

      <el-card>
        <el-form :model="sched" label-width="120px">
          <el-form-item label="选择科室" required>
            <el-select v-model="sched.deptId" @change="$emit('change-dept')" placeholder="请选择科室" style="width: 300px">
              <el-option
                v-for="d in depts"
                :key="d.id"
                :label="d.name"
                :value="String(d.id)"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="选择医生" required>
            <el-select v-model="sched.doctorId" placeholder="请选择医生" style="width: 300px" :disabled="!sched.deptId">
              <el-option
                v-for="d in filteredDoctors"
                :key="d.id"
                :label="d.name"
                :value="String(d.id)"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="排班日期" required>
            <el-date-picker
              v-model="sched.date"
              type="date"
              placeholder="选择日期"
              value-format="YYYY-MM-DD"
              style="width: 300px"
            />
          </el-form-item>

          <el-form-item label="选择时段" required>
            <el-checkbox-group v-model="sched.slots">
              <el-checkbox label="8-10">8:00-10:00</el-checkbox>
              <el-checkbox label="10-12">10:00-12:00</el-checkbox>
              <el-checkbox label="14-16">14:00-16:00</el-checkbox>
              <el-checkbox label="16-18">16:00-18:00</el-checkbox>
            </el-checkbox-group>
            <div style="color: #909399; font-size: 12px; line-height: 1.5;">提示：如需自定义其他时段，请联系系统管理员配置。</div>
          </el-form-item>

          <el-divider content-position="left">号源容量设置</el-divider>

          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="普通号" label-width="80px">
                <el-input-number v-model="sched.cap.normal" :min="0" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="专家号" label-width="80px">
                <el-input-number v-model="sched.cap.expert" :min="0" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="特需号" label-width="80px">
                <el-input-number v-model="sched.cap.vip" :min="0" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item style="margin-top: 20px;">
            <el-button type="primary" @click="$emit('save-availability')" size="large">保存排班</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <!-- 已发布号源列表 -->
    <div v-if="localSubTab === 'sources'">
      <el-table :data="availList" stripe style="width: 100%" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="医生">
          <template #default="scope">
            {{ findDoctorName(scope.row.doctor_id) }}
          </template>
        </el-table-column>
        <el-table-column label="科室">
          <template #default="scope">
            {{ findDeptName(findDoctorDeptId(scope.row.doctor_id)) }}
          </template>
        </el-table-column>
        <el-table-column prop="date" label="日期" sortable />
        <el-table-column prop="slot" label="时段" />
        <el-table-column label="号源详情 (类型:数量)">
          <template #default="scope">
            <el-tag type="info" effect="plain">{{ renderTypes(scope.row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button 
              type="danger" 
              size="small" 
              :icon="Delete"
              @click="$emit('delete-availability', scope.row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无号源数据" />
        </template>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Delete } from '@element-plus/icons-vue'

const props = defineProps({
  depts: { type: Array, default: () => [] },
  doctors: { type: Array, default: () => [] },
  filteredDoctors: { type: Array, default: () => [] },
  sched: { type: Object, required: true },
  availList: { type: Array, default: () => [] },
  schedSubTab: { type: String, default: 'schedule' },
  findDeptName: { type: Function, required: true },
  findDoctorName: { type: Function, required: true },
  findDoctorDeptId: { type: Function, required: true },
  renderTypes: { type: Function, required: true }
})

const emit = defineEmits(['update:sched-sub-tab', 'change-dept', 'save-availability', 'delete-availability'])

const localSubTab = ref(props.schedSubTab)

watch(() => props.schedSubTab, (val) => {
  localSubTab.value = val
})

const handleTabChange = (val) => {
  emit('update:sched-sub-tab', val)
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
}
</style>
