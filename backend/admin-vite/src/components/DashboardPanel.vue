<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card>
          <div class="stat-title">近期挂号（30天）</div>
          <div ref="regChart" style="height:200px;"></div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-title">退号率（30天）</div>
          <div class="stat-value">
            <div class="rate">{{ (refund.rate*100).toFixed(2) }}%</div>
            <div class="meta">取消 {{refund.cancelled}} / 总计 {{refund.total}}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <div class="stat-title">科室结构</div>
          <el-tree :data="deptsTree" :props="treeProps" node-key="id" accordion default-expand-all></el-tree>
        </el-card>
      </el-col>
    </el-row>

    <el-row style="margin-top:20px">
      <el-col :span="24">
        <el-card>
          <div class="stat-title">月度排班日历（{{month}}）</div>
          <div class="calendar-grid">
            <table class="calendar-table">
              <thead>
                <tr>
                  <th v-for="d in weekDays" :key="d">{{d}}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(week, wi) in calendarMatrix" :key="wi">
                  <td v-for="(cell, ci) in week" :key="ci" class="calendar-cell">
                    <div v-if="cell" class="cell-content">
                      <div class="cell-date">{{ cell.day }}</div>
                        <div class="cell-brief">
                          <div v-for="(slot, si) in slotsOrder" :key="slot" class="slot-row">
                            <div class="slot-label">{{ slotLabel(slot) }}</div>
                            <div class="slot-doctors">
                              <el-button v-for="doc in (availByDateSlot[cell.iso] && availByDateSlot[cell.iso][slot] ? availByDateSlot[cell.iso][slot] : [])" :key="doc.doctor_id" type="text" class="doc-name" @click="showDoctor(doc.doctor_id)">{{ shortName(doc.name) }}</el-button>
                            </div>
                          </div>
                        </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog :visible.sync="doctorDialogVisible" width="480px" :before-close="() => { doctorDialogVisible = false }">
      <template #title>医生详情</template>
      <div v-if="selectedDoctor">
        <h3 style="margin:0">{{ selectedDoctor.name }}</h3>
        <div style="color:var(--muted);margin-top:8px">职称：{{ selectedDoctor.title || '—' }}</div>
        <div style="margin-top:8px">科室：{{ deptName(selectedDoctor.department_id) }}</div>
        <div style="margin-top:8px">联系方式：{{ selectedDoctor.contact || '—' }}</div>
        <div style="margin-top:12px">简介：{{ selectedDoctor.bio || '暂无简介' }}</div>
      </div>
      <template #footer>
        <el-button @click="doctorDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import * as echarts from 'echarts'

const regChart = ref(null)
const registrations = ref([])
const refund = reactive({ cancelled:0, total:0, rate:0 })
const deptsTree = ref([])
const treeProps = { children: 'children', label: 'name' }

const month = ref(new Date().toISOString().slice(0,7))
const availability = ref({})
const availByDateSlot = ref({})
const doctors = ref([])
const doctorMap = ref({})
const slotsOrder = ['8-10','10-12','14-16','16-18']
const doctorDialogVisible = ref(false)
const selectedDoctor = ref(null)
const weekDays = ['日','一','二','三','四','五','六']
const calendarMatrix = ref([])

const api = async (path, opts = {}) => {
  opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  const token = localStorage.getItem('admin_token')
  if (token) opts.headers['Authorization'] = 'Bearer ' + token
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body)
  try {
    const res = await fetch(path, opts)
    return await res.json()
  } catch (e) { return { success:false, message:'network error' } }
}

onMounted(async () => {
  await loadRegistrations()
  await loadRefundRate()
  await loadDeptsTree()
  await loadScheduleCalendar()
  await loadDoctors()
  await loadAvailabilities()
  renderRegChart()
})

async function loadRegistrations() {
  const res = await api('/api/admin/stats/registrations?days=30')
  registrations.value = (res && res.success) ? res.data : []
}

async function loadRefundRate() {
  const res = await api('/api/admin/stats/refund-rate?days=30')
  if (res && res.success) {
    refund.cancelled = res.data.cancelled
    refund.total = res.data.total
    refund.rate = res.data.rate
  }
}

async function loadDeptsTree() {
  const res = await api('/api/admin/departments/tree')
  deptsTree.value = (res && res.success) ? res.data : []
}

async function loadDoctors() {
  const res = await api('/api/admin/doctors')
  doctors.value = (res && res.success) ? (res.data || []) : []
  const map = {}
  for (const d of doctors.value) map[d.id] = d
  doctorMap.value = map
}

async function loadAvailabilities() {
  // fetch all availability and organize by date->slot->[{doctor_id,name,...}]
  const res = await api('/api/admin/availability')
  const rows = (res && res.success) ? (res.data || []) : []
  const m = {}
  for (const r of rows) {
    const date = r.date
    const slot = r.slot
    if (!m[date]) m[date] = {}
    if (!m[date][slot]) m[date][slot] = []
    const doc = doctorMap.value[r.doctor_id] || { id: r.doctor_id, name: '医生#' + r.doctor_id }
    m[date][slot].push({ doctor_id: r.doctor_id, name: doc.name, availability_id: r.id })
  }
  availByDateSlot.value = m
}

function slotLabel(slot){
  // map label short
  if (slot === '8-10') return '早间'
  if (slot === '10-12') return '上午'
  if (slot === '14-16') return '下午'
  if (slot === '16-18') return '傍晚'
  return slot
}

function shortName(name){
  if (!name) return ''
  return name.length > 6 ? name.slice(0,6) + '…' : name
}

function deptName(id){
  const find = (arr, id) => {
    for (const n of arr) {
      if (n.id === id) return n.name
      if (n.children) {
        const r = find(n.children, id)
        if (r) return r
      }
    }
    return ''
  }
  return find(deptsTree.value, id) || ''
}

async function showDoctor(id){
  selectedDoctor.value = doctorMap.value[id] || null
  if (!selectedDoctor.value) {
    // try fetch list again
    await loadDoctors()
    selectedDoctor.value = doctorMap.value[id] || null
  }
  doctorDialogVisible.value = true
}

function buildCalendar(yearMonth) {
  // build matrix of weeks for month (cells with day and iso date)
  const [y, m] = yearMonth.split('-').map(Number)
  const first = new Date(y, m-1, 1)
  const last = new Date(y, m, 0)
  const matrix = []
  let week = new Array(7).fill(null)
  // fill blanks
  for (let d=1; d<=last.getDate(); d++) {
    const date = new Date(y, m-1, d)
    const iso = date.toISOString().slice(0,10)
    const cell = { day: d, iso }
    const wd = date.getDay()
    week[wd] = cell
    if (wd === 6 || d === last.getDate()) { matrix.push(week); week = new Array(7).fill(null) }
  }
  calendarMatrix.value = matrix
}

async function loadScheduleCalendar() {
  const res = await api('/api/admin/stats/schedule-calendar?month=' + month.value)
  availability.value = (res && res.success) ? res.data : {}
  buildCalendar(month.value)
}

function renderRegChart() {
  const el = regChart.value
  if (!el) return
  const chart = echarts.init(el)
  const x = registrations.value.map(r => r.day)
  const y = registrations.value.map(r => r.count)
  const option = {
    xAxis: { type: 'category', data: x },
    yAxis: { type: 'value' },
    series: [{ data: y, type: 'line', smooth: true }],
    tooltip: { trigger: 'axis' }
  }
  chart.setOption(option)
}
</script>

<style scoped>
.dashboard { padding: 16px }
.stat-title { font-weight: 600; margin-bottom: 8px }
.stat-value { display:flex; flex-direction:column; align-items:center; justify-content:center; height:120px }
.rate { font-size:36px; color:#f56c6c; font-weight:700 }
.meta { color:#999 }
.calendar-grid { overflow:auto }
.calendar-table { width:100%; border-collapse:collapse }
.calendar-table th, .calendar-table td { border:1px solid #eee; padding:8px; vertical-align:top }
.calendar-cell { height:90px }
.cell-date { font-weight:600 }
.avail-item { font-size:12px; color:#409EFF; margin-top:4px }
.slot-row { display:flex; align-items:center; gap:6px; margin-top:6px }
.slot-label { width:48px; font-size:12px; color:#666 }
.slot-doctors { display:flex; flex-wrap:wrap; gap:6px }
.doc-name { padding:2px 6px; font-size:12px; color:#333 }
</style>
