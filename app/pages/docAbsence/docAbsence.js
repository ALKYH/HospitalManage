const { request } = require('../../utils/request');
Page({
  data: { from_date: '', to_date: '', reason: '' },
  onFromDate(e) { this.setData({ from_date: e.detail.value }); },
  onToDate(e) { this.setData({ to_date: e.detail.value }); },
  onReason(e) { this.setData({ reason: e.detail.value }); },
  async submit() {
    const { from_date, to_date, reason } = this.data;
    if (!from_date || !to_date) return wx.showToast({ title: '请选择起止日期', icon: 'none' });
    try {
      const res = await request({ url: '/api/doctor/me/leave', method: 'POST', data: { from_date, to_date, reason } });
      if (res && res.success) {
        wx.showToast({ title: '申请已提交', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 800);
      }
    } catch (err) {
      console.error('submit leave err', err);
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  }
});
