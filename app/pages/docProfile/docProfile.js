// pages/docProfile/docProfile.js
const request = require('../../utils/request')

Page({

  data: {

    filteredDoctors: [],
      registrations: [],
      message: ''
  },

  onLoad(options) {

      this.loadRegistrations()
  },
  goToDepartment() {
    wx.navigateTo({
      url: '/pages/deptPick/deptPick'
    });
  },
  goToDocs() {
    wx.navigateTo({
      url: '/pages/docPick/docPick'
    });
  },
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    const selected = wx.getStorageSync('selectedDepartment');
    if (selected) {
      this.setData({
        selectedDept: selected,
      });
      wx.removeStorageSync('selectedDepartment'); // 用完后清除缓存
    }
    const selectedDocs = wx.getStorageSync('selectedDoc');
    if (selectedDocs) {
      this.setData({
        selectedDoc: selectedDocs
      });
      wx.removeStorageSync('selectedDoc'); // 用完后清除缓存
    }
  },
  onDeptChange: function(e) {

  },
  async loadRegistrations() {
      this.setData({ message: '正在加载...' })
      try {
        const res = await request.get('/api/registration/my-registrations')
        if (res && res.success) {
          this.setData({ registrations: res.data || [], message: '' })
        } else {
          this.setData({ message: res && res.message ? res.message : '无法获取挂号记录' })
        }
      } catch (err) {
        console.error('loadRegistrations error:', err)
        // 尝试从标准错误结构中提取 message
        let msg = '加载失败';
        if (err && err.body && err.body.message) msg = err.body.message;
        else if (err && err.error && err.error.message) msg = err.error.message;
        else if (err && err.message) msg = err.message;
        this.setData({ message: msg })
      }
    },  
  onDocChange: function(e) {
  }
})