import { ElMessage } from 'element-plus'

export const api = async (path, opts = {}) => {
  opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
  const token = localStorage.getItem('admin_token')
  if (token) opts.headers['Authorization'] = 'Bearer ' + token
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body)
  
  try {
    const res = await fetch(path, opts)
    if (res.status === 401) {
      localStorage.removeItem('admin_token')
      ElMessage.error('登录已过期，请重新登录')
      // 这里可能需要一种方式通知 App.vue 更新 authed 状态，或者直接刷新页面
      // window.location.reload() // 简单粗暴的方式
      return { success: false, message: 'Unauthorized', status: 401 }
    }
    return await res.json()
  } catch (e) {
    return { success: false, message: 'Network error or invalid json' }
  }
}
