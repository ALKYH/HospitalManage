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

          <el-form-item label="周排班（按周一次性提交）" required>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-weight:600">选择周</div>
                <div>
                  <el-button size="small" type="text" @click="prevWeek">上一周</el-button>
                  <el-button size="small" type="text" @click="nextWeek">下一周</el-button>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;max-width:100%;">
                <div v-for="(d, idx) in weekDates" :key="d" style="background:var(--panel);padding:6px;border-radius:8px;box-shadow:var(--card-shadow);min-height:110px;display:flex;flex-direction:column;justify-content:flex-start;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <div style="font-weight:600;color:var(--primary);font-size:13px">{{ weekdays[idx] }}</div>
                    <div style="font-size:12px;color:var(--muted)">{{ d }}</div>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
                    <el-checkbox-group v-model="perDaySlots[d]">
                      <el-checkbox label="8-10">8:00-10:00</el-checkbox>
                      <el-checkbox label="10-12">10:00-12:00</el-checkbox>
                      <el-checkbox label="14-16">14:00-16:00</el-checkbox>
                      <el-checkbox label="16-18">16:00-18:00</el-checkbox>
                    </el-checkbox-group>
                  </div>
                </div>
              </div>

              <div style="color:var(--muted);font-size:12px">提示：在每列选中对应时段，点击“保存排班”将一次性为本周选中日期的各时段创建排班。</div>
            </div>
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
import { ref, watch, computed } from 'vue'
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

// Week-view selector: 每列代表周中的一天，每列可选多个时段
const weekdays = ['周一','周二','周三','周四','周五','周六','周日']

const getWeekStart = () => {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday=0
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0,0,0,0);
  return monday
}
const weekStart = ref(getWeekStart())

const weekDates = computed(() => {
  const arr = []
  const base = new Date(weekStart.value)
  for (let i = 0; i < 7; i++) {
    const dd = new Date(base)
    dd.setDate(base.getDate() + i)
    arr.push(dd.toISOString().slice(0,10))
  }
  return arr
})

// perDaySlots: { '2025-12-15': ['8-10','14-16'], ... }
const perDaySlots = ref({})

// keep sched.perDaySlots in sync and initialize perDaySlots for current week
watch(weekDates, (newv) => {
  for (const d of newv) if (!perDaySlots.value[d]) perDaySlots.value[d] = []
  // also write initial mapping to sched.perDaySlots if absent
  try { props.sched.perDaySlots = Object.assign({}, perDaySlots.value) } catch (e) {}
}, { immediate: true })

// (week offset and multi-week application removed — submissions apply to the configured week only)

const prevWeek = () => { const b = new Date(weekStart.value); b.setDate(b.getDate() - 7); weekStart.value = b }
const nextWeek = () => { const b = new Date(weekStart.value); b.setDate(b.getDate() + 7); weekStart.value = b }

// when perDaySlots change, sync into props.sched.perDaySlots
watch(perDaySlots, (nv) => {
  try { props.sched.perDaySlots = Object.assign({}, nv) } catch (e) {}
}, { deep: true })

</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
}
</style>
