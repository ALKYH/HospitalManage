<template>
  <div class="statistics-panel">
    <div style="margin-bottom: 20px; display: flex; justify-content: flex-end;">
      <el-button type="primary" :icon="Refresh" @click="fetchData" :loading="loading">刷新数据</el-button>
    </div>

    <el-row :gutter="20">
      <!-- 关键指标卡片 -->
      <el-col :span="6" v-for="card in cards" :key="card.title">
        <el-card shadow="hover" class="stat-card">
          <template #header>
            <div class="card-header">
              <span>{{ card.title }}</span>
              <el-tag :type="card.type" effect="plain">{{ card.tag }}</el-tag>
            </div>
          </template>
          <div class="card-value">{{ card.value }}</div>
          <div class="card-footer">
            <span>较昨日</span>
            <span :class="card.trend > 0 ? 'up' : 'down'">
              {{ Math.abs(card.trend) }}% 
              <el-icon><component :is="card.trend > 0 ? 'Top' : 'Bottom'" /></el-icon>
            </span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <!-- 左侧折线图 -->
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="chart-header">
              <span>近7日挂号趋势</span>
            </div>
          </template>
          <div ref="lineChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
      
      <!-- 右侧饼图 -->
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="chart-header">
              <span>科室挂号占比</span>
            </div>
          </template>
          <div ref="pieChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { Top, Bottom, Refresh } from '@element-plus/icons-vue'
import { api } from '../utils/api'
import { ElMessage } from 'element-plus'

// 初始数据卡片
const cards = ref([
  { title: '今日挂号', value: '0', trend: 0, type: 'primary', tag: '日' },
  { title: '今日收入', value: '¥ 0.00', trend: 0, type: 'success', tag: '日' },
  { title: '新增患者', value: '0', trend: 0, type: 'warning', tag: '日' },
  { title: '医生出诊', value: '0', trend: 0, type: 'info', tag: '日' }
])

const lineChartRef = ref(null)
const pieChartRef = ref(null)
const loading = ref(false)
let lineChart = null
let pieChart = null

const fetchData = async () => {
  loading.value = true
  try {
    const res = await api('/api/admin/statistics')
    if (res && res.success) {
      cards.value = res.data.cards
      updateCharts(res.data.trend, res.data.departmentShare)
      ElMessage.success('数据已更新')
    } else {
      ElMessage.error(res.message || '获取统计数据失败')
    }
  } finally {
    loading.value = false
  }
}

const updateCharts = (trendData, deptData) => {
  if (lineChart) {
    lineChart.setOption({
      xAxis: {
        data: trendData.dates
      },
      series: [
        {
          data: trendData.values
        }
      ]
    })
  }

  if (pieChart) {
    pieChart.setOption({
      series: [
        {
          data: deptData
        }
      ]
    })
  }
}

const initCharts = () => {
  if (lineChartRef.value) {
    lineChart = echarts.init(lineChartRef.value)
    lineChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: []
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '挂号量',
          type: 'line',
          smooth: true,
          data: [],
          areaStyle: { opacity: 0.1 },
          itemStyle: { color: '#409EFF' }
        }
      ]
    })
  }

  if (pieChartRef.value) {
    pieChart = echarts.init(pieChartRef.value)
    pieChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: '0%', left: 'center' },
      series: [
        {
          name: '科室占比',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: { show: false, position: 'center' },
          emphasis: {
            label: { show: true, fontSize: '20', fontWeight: 'bold' }
          },
          labelLine: { show: false },
          data: []
        }
      ]
    })
  }
}

onMounted(async () => {
  await nextTick()
  initCharts()
  await fetchData()
  window.addEventListener('resize', handleResize)
})

const handleResize = () => {
  lineChart && lineChart.resize()
  pieChart && pieChart.resize()
}

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  lineChart && lineChart.dispose()
  pieChart && pieChart.dispose()
})
</script>

<style scoped>
.stat-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stat-card .card-value {
  font-size: 28px;
  font-weight: bold;
  margin: 10px 0;
  color: #303133;
}
.stat-card .card-footer {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #909399;
}
.up { color: #67C23A; display: flex; align-items: center; }
.down { color: #F56C6C; display: flex; align-items: center; }
</style>
