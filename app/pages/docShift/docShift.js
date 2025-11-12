// pages/docShift/docShift.js
Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const today = new Date().toISOString().slice(0,10);
    this.setData({ date: today, slots: ['8-10','10-12','14-16','16-18'], selectedSlot: '8-10', selectedSlotLabel: '8-10', capacity: 1 });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadAvailability();
  },

  onDateChange(e) { this.setData({ date: e.detail.value }); },

  onSlotChange(e) {
    const idx = e.detail.value;
    const slots = this.data.slots || ['8-10','10-12','14-16','16-18'];
    this.setData({ selectedSlot: slots[idx], selectedSlotLabel: slots[idx] });
  },

  onCapacityChange(e) { this.setData({ capacity: parseInt(e.detail.value, 10) || 1 }); },

  async loadAvailability() {
    const date = this.data.date || new Date().toISOString().slice(0,10);
    this.setData({ loading: true });
    const { request } = require('../../utils/request');
    try {
      // prefer cached doctor_id to avoid extra call
      const cachedDoctorId = wx.getStorageSync('doctor_id');
      let doctorId = cachedDoctorId || null;
      if (!doctorId) {
        const me = await request({ url: '/api/doctor/me', method: 'GET' });
        if (!me || !me.success) return this.setData({ message: '获取医生信息失败' });
        doctorId = me.data && me.data.id;
        if (doctorId) wx.setStorageSync('doctor_id', doctorId);
      }
      const res = await request({ url: '/api/doctor/' + doctorId + '/availability', method: 'GET' });
      if (res && res.success) {
        const list = res.data || [];
        const filtered = list.filter(it => !date || it.date === date);
        this.setData({ availability: filtered, message: '' });
      } else this.setData({ message: res && res.message || '获取排班失败' });
    } catch (err) {
      console.error('load avail err', err);
      this.setData({ message: err && err.body && err.body.message || '网络或服务错误' });
    } finally { this.setData({ loading: false }); }
  },

  async createAvailability() {
    const date = this.data.date || new Date().toISOString().slice(0,10);
    const slot = this.data.selectedSlot || '8-10';
    const capacity = this.data.capacity || 1;
    const { request } = require('../../utils/request');
    try {
      const res = await request({ url: '/api/doctor/me/availability', method: 'POST', data: { date, slot, capacity } });
      if (res && res.success) { wx.showToast({ title: '保存成功' });
        // clear editing state
        this.setData({ editingId: null });
        this.loadAvailability();
      } else this.setData({ message: res && res.message || '保存失败' });
    } catch (err) { console.error('create avail err', err); this.setData({ message: err && err.body && err.body.message || '网络或服务错误' }); }
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const { request } = require('../../utils/request');
    try {
      await request({ url: '/api/doctor/me/availability/' + id, method: 'DELETE' });
      wx.showToast({ title: '删除成功' });
      this.loadAvailability();
    } catch (err) { console.error('del err', err); this.setData({ message: err && err.body && err.body.message || '删除失败' }); }
  },

  onEdit(e) {
    // stop event propagation for button
    const id = e.currentTarget.dataset.id;
    const item = (this.data.availability || []).find(x => x.id == id);
    if (!item) return;
    this.setData({ date: item.date, selectedSlot: item.slot, selectedSlotLabel: item.slot, capacity: item.capacity, editingId: item.id });
    wx.showToast({ title: '已载入排班，修改后点击保存' });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})