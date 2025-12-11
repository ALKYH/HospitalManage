<template>
  <!-- 登录页 -->
  <div v-if="!authed" class="login-container">
    <el-card class="login-card" shadow="hover">
      <h2 class="login-title">医院管理后台</h2>
      <el-form :model="login" @submit.prevent="doLogin">
        <el-form-item>
          <el-input 
            v-model="login.username" 
            placeholder="用户名" 
            :prefix-icon="User"
            size="large"
          />
        </el-form-item>
        <el-form-item>
          <el-input 
            v-model="login.password" 
            type="password" 
            placeholder="密码" 
            :prefix-icon="Lock"
            show-password
            size="large"
            @keyup.enter="doLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button 
            type="primary" 
            :loading="login.loading" 
            style="width: 100%" 
            size="large"
            @click="doLogin"
          >
            登录
          </el-button>
        </el-form-item>
        <el-alert 
          v-if="login.msg" 
          :title="login.msg" 
          type="error" 
          show-icon 
          :closable="false" 
        />
      </el-form>
    </el-card>
  </div>

  <!-- 主界面 -->
  <el-container v-else class="main-container">
    <el-aside width="220px">
      <el-menu
        :default-active="curTab"
        class="aside-menu"
        @select="switchTab"
      >
        <div style="height: 60px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #f0f0f0;">
          <h3 style="margin:0; color:#409EFF;">Hospital Admin</h3>
        </div>
        <el-menu-item index="depts">
          <el-icon><OfficeBuilding /></el-icon>
          <span>科室管理</span>
        </el-menu-item>
        <el-menu-item index="doctors">
          <el-icon><User /></el-icon>
          <span>医生管理</span>
        </el-menu-item>
        <el-menu-item index="schedules">
          <el-icon><Calendar /></el-icon>
          <span>排班与号源</span>
        </el-menu-item>
        <el-menu-item index="orders">
          <el-icon><List /></el-icon>
          <span>订单管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header>
        <div class="header-title">
          {{ pageTitle }}
        </div>
        <div>
          <el-button @click="toggleTheme" circle :icon="Moon" title="切换主题" />
          <el-button type="danger" plain @click="logout" :icon="SwitchButton">退出</el-button>
        </div>
      </el-header>

      <el-main>
        <DeptsPanel v-if="curTab==='depts'"
          :depts="depts"
          :dept-form="deptForm"
          v-model:depts-sub-tab="deptsSubTab"
          :find-dept-name="findDeptName"
          @create-dept="createDept"
          @delete-dept="delDept"
        />

        <DoctorsPanel v-if="curTab==='doctors'"
          :doctors="doctors"
          :depts="depts"
          :doctor-form="doctorForm"
          v-model:doctors-sub-tab="doctorsSubTab"
          :find-dept-name="findDeptName"
          @create-doctor="createDoctor"
          @delete-doctor="delDoctor"
          @set-doctor-pwd="setDoctorPwd"
        />

        <SchedulesPanel v-if="curTab==='schedules'"
          :depts="depts"
          :doctors="doctors"
          :filtered-doctors="filteredDoctors"
          :sched="sched"
          :avail-list="availList"
          v-model:sched-sub-tab="schedSubTab"
          :find-dept-name="findDeptName"
          :find-doctor-name="findDoctorName"
          :find-doctor-dept-id="findDoctorDeptId"
          :render-types="renderTypes"
          @change-dept="onSchedDeptChange"
          @save-availability="saveAvailability"
          @delete-availability="delAvailability"
        />

        <OrdersPanel v-if="curTab==='orders'"
          :orders="orders"
          :doctors="doctors"
          @refresh="fetchOrders"
          @cancel-order="cancelOrder"
        />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { User, Lock, OfficeBuilding, Calendar, List, Moon, SwitchButton } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DeptsPanel from './components/DeptsPanel.vue'
import DoctorsPanel from './components/DoctorsPanel.vue'
import SchedulesPanel from './components/SchedulesPanel.vue'
import OrdersPanel from './components/OrdersPanel.vue'

// State
const authed = ref(!!localStorage.getItem('admin_token'))
const curTab = ref('depts')
const login = reactive({ username: '', password: '', loading: false, msg: '' })
const depts = ref([])
const doctors = ref([])
const deptForm = reactive({ name: '', code: '', parent_id: '' })
const doctorForm = reactive({ name: '', title: '', contact: '', department_id: '' })
const sched = reactive({ deptId: '', doctorId: '', date: '', slots: [], cap: { normal: 5, expert: 2, vip: 1 } })
const availList = ref([])
const schedSubTab = ref('schedule')
const deptsSubTab = ref('list')
const orders = reactive({ filterDoctorId: '', filterDate: '', filterStatus: '', list: [] })
const doctorsSubTab = ref('list')

// Computed
const pageTitle = computed(() => {
  const map = {
    depts: '科室管理',
    doctors: '医生管理',
    schedules: '排班与号源设置',
    orders: '订单管理'
  }
  return map[curTab.value] || '管理后台'
})

const filteredDoctors = computed(() => {
  if (!sched.deptId) return doctors.value
  return doctors.value.filter(d => String(d.department_id) === String(sched.deptId))
})

// API Helper
const api = async (path, opts = {}) => {
  opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  const token = localStorage.getItem('admin_token')
  if (token) opts.headers['Authorization'] = 'Bearer ' + token
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body)
  
  try {
    const res = await fetch(path, opts)
    if (res.status === 401) {
      localStorage.removeItem('admin_token')
      ElMessage.error('登录已过期，请重新登录')
      authed.value = false
      return { success: false, message: 'Unauthorized', status: 401 }
    }
    return await res.json()
  } catch (e) {
    return { success: false, message: 'Network error or invalid json' }
  }
}

// Methods
const toggleTheme = () => {
  const html = document.documentElement
  if (html.classList.contains('dark')) {
    html.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  } else {
    html.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  }
}

const doLogin = async () => {
  if (!login.username || !login.password) return
  login.loading = true; login.msg = ''
  const res = await api('/auth/login', { method: 'POST', body: { username: login.username, password: login.password } })
  login.loading = false
  if (res && res.success) {
    const token = res.token || (res.data && res.data.token)
    if (token) localStorage.setItem('admin_token', token)
    authed.value = true
    curTab.value = 'depts'
    ElMessage.success('登录成功')
    await loadAll()
  } else {
    login.msg = (res && res.message) || '登录失败'
  }
}

const loadAll = async () => {
  await loadDepts()
  await loadDoctors()
  await fetchAvailabilitiesForCurrent()
}

const loadDepts = async () => {
  const res = await api('/api/admin/departments')
  depts.value = res && res.success ? (res.data || []) : []
  if (deptForm.parent_id && !depts.value.find(d => String(d.id) === String(deptForm.parent_id))) { deptForm.parent_id = '' }
}

const createDept = async () => {
  if (!deptForm.name) { ElMessage.warning('请输入科室名'); return }
  const res = await api('/api/admin/departments', { method: 'POST', body: { name: deptForm.name, code: deptForm.code, parent_id: deptForm.parent_id || null } })
  if (res && res.success) {
    ElMessage.success('科室创建成功')
    deptForm.name = ''; deptForm.code = ''; deptForm.parent_id = ''
    deptsSubTab.value = 'list' // 自动切回列表
    await loadDepts()
  } else {
    ElMessage.error(res.message || '创建失败')
  }
}

const delDept = async (id) => {
  const r = await api('/api/admin/departments/' + id, { method: 'DELETE' })
  if (r && r.success) {
    ElMessage.success('删除成功')
    await loadDepts()
  } else {
    ElMessage.error('删除失败: ' + (r.message || '未知错误'))
  }
}

const loadDoctors = async () => {
  const res = await api('/api/admin/doctors')
  doctors.value = res && res.success ? (res.data || []) : []
}

const createDoctor = async () => {
  if (!doctorForm.name) { ElMessage.warning('请输入医生姓名'); return }
  const res = await api('/api/admin/doctors', { method: 'POST', body: { name: doctorForm.name, title: doctorForm.title, contact: doctorForm.contact, department_id: doctorForm.department_id || null } })
  if (res && res.success) {
    ElMessage.success('医生创建成功')
    doctorForm.name = ''; doctorForm.title = ''; doctorForm.contact = ''; doctorForm.department_id = ''
    doctorsSubTab.value = 'list'
    await loadDoctors()
  } else {
    ElMessage.error(res.message || '创建失败')
  }
}

const setDoctorPwd = async (id) => {
  ElMessageBox.prompt('请输入新密码', '重置密码', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputType: 'password',
  }).then(async ({ value }) => {
    if (!value) return ElMessage.warning('密码不能为空')
    
    // Optional username prompt could be added here or simplified
    const body = { password: value }
    const r = await api('/api/admin/doctors/' + id + '/set-password', { method: 'POST', body })
    if (r && r.success) { 
      ElMessage.success('密码设置成功')
      await loadDoctors() 
    } else {
      ElMessage.error('设置失败: ' + ((r && r.message) || '未知错误'))
    }
  }).catch(() => {})
}

const delDoctor = async (id) => {
  ElMessageBox.confirm('确认删除该医生吗？', '警告', { type: 'warning' })
    .then(async () => {
      const r = await api('/api/admin/doctors/' + id, { method: 'DELETE' })
      if (r && r.success) {
        ElMessage.success('删除成功')
        await loadDoctors()
      } else {
        ElMessage.error('删除失败: ' + (r.message || '未知错误'))
      }
    })
    .catch(() => {})
}

const onSchedDeptChange = () => {
  sched.doctorId = ''
  if (schedSubTab.value === 'sources') fetchAvailabilitiesForCurrent()
}

const fetchAvailabilities = async (doctorId) => {
  const url = doctorId ? `/api/admin/availability/${doctorId}` : '/api/admin/availability'
  const res = await api(url)
  availList.value = (res && res.success) ? (res.data || []) : []
}

const fetchAvailabilitiesForCurrent = async () => {
  if (sched.doctorId) { await fetchAvailabilities(sched.doctorId) }
  else await fetchAvailabilities(null)
}

const saveAvailability = async () => {
  const doctor_id = sched.doctorId
  const date = sched.date
  const slots = sched.slots.slice()
  if (!doctor_id || !date || slots.length === 0) { ElMessage.warning('请选择科室/医生/日期/时段'); return }
  
  const capacity_types = { '普通': Number(sched.cap.normal || 0), '专家': Number(sched.cap.expert || 0), '特需': Number(sched.cap.vip || 0) }
  const capacity = Object.values(capacity_types).reduce((a, b) => a + Number(b || 0), 0)
  
  let successCount = 0
  for (const slot of slots) {
    const res = await api('/api/admin/availability', { method: 'POST', body: { doctor_id: parseInt(doctor_id, 10), date, slot, capacity, extra: { capacity_types, booked_types: {} } } })
    if (res && res.success) successCount++
  }
  
  if (successCount > 0) {
    ElMessage.success(`成功保存 ${successCount} 个时段的排班`)
    await fetchAvailabilitiesForCurrent()
  } else {
    ElMessage.error('保存失败')
  }
}

const delAvailability = async (id) => {
  ElMessageBox.confirm('确认删除该排班记录吗？', '提示', { type: 'warning' })
    .then(async () => {
      const r = await api('/api/admin/availability/' + id, { method: 'DELETE' })
      if (r && r.success) { 
        ElMessage.success('删除成功')
        await fetchAvailabilitiesForCurrent() 
      } else {
        ElMessage.error('删除失败: ' + (r.message || '未知错误'))
      }
    }).catch(() => {})
}

const fetchOrders = async () => {
  let q = '/api/admin/orders?'
  if (orders.filterDoctorId) q += 'doctor_id=' + encodeURIComponent(orders.filterDoctorId) + '&'
  if (orders.filterDate) q += 'date=' + encodeURIComponent(orders.filterDate) + '&'
  if (orders.filterStatus) q += 'status=' + encodeURIComponent(orders.filterStatus) + '&'
  const res = await api(q)
  orders.list = (res && res.success) ? (res.data || []) : []
  ElMessage.success('订单列表已刷新')
}

const cancelOrder = async (id) => {
  ElMessageBox.confirm('确认取消该订单吗？', '警告', { type: 'warning' })
    .then(async () => {
      const r = await api('/api/registration/cancel', { method: 'POST', body: { order_id: id } })
      if (r && r.success) { 
        ElMessage.success('订单已取消')
        await fetchOrders() 
      } else {
        ElMessage.error('取消失败: ' + (r.message || '未知错误'))
      }
    }).catch(() => {})
}

const findDeptName = (id) => { const d = depts.value.find(x => String(x.id) === String(id)); return d ? d.name : '' }
const findDoctorName = (id) => { const d = doctors.value.find(x => String(x.id) === String(id)); return d ? d.name : '' }
const findDoctorDeptId = (doctorId) => { const d = doctors.value.find(x => String(x.id) === String(doctorId)); return d ? d.department_id : '' }
const renderTypes = (r) => {
  const types = r && r.extra && r.extra.capacity_types ? r.extra.capacity_types : null
  if (!types) return ''
  return Object.entries(types).map(([k, v]) => `${k}:${v}`).join(', ')
}

const switchTab = async (t) => {
  curTab.value = t
  if (t === 'orders') await fetchOrders()
  if (t === 'schedules' && schedSubTab.value === 'sources') await fetchAvailabilitiesForCurrent()
}

const logout = () => {
  localStorage.removeItem('admin_token')
  authed.value = false
  depts.value = []
  doctors.value = []
  availList.value = []
  ElMessage.info('已退出登录')
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') document.documentElement.classList.add('dark')
  if (authed.value) { loadAll() }
})
</script>
