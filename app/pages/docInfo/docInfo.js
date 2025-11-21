// pages/docInfo/docInfo.js
const { request } = require('../../utils/request');
Page({
  data: {
    doctor: { name: '', title: '', bio: '', contact: '' }
  },
  onLoad(options) {
    this.loadMyDoctor();
  },
  async loadMyDoctor() {
    try {
      const res = await request({ url: '/api/doctor/me' });
      if (res && res.success && res.data) {
        this.setData({ doctor: res.data });
      }
    } catch (err) {
      console.error('loadMyDoctor err', err);
      wx.showToast({ title: '加载医生信息失败', icon: 'none' });
    }
  },
  onChangeName(e) { this.setData({ ['doctor.name']: e.detail.value }); },
  onChangeTitle(e) { this.setData({ ['doctor.title']: e.detail.value }); },
  onChangeContact(e) { this.setData({ ['doctor.contact']: e.detail.value }); },
  onChangeBio(e) { this.setData({ ['doctor.bio']: e.detail.value }); },
  async onSave() {
    const payload = this.data.doctor || {};
    try {
      const res = await request({ url: '/api/doctor/me', method: 'PUT', data: payload });
      if (res && res.success) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({ doctor: res.data });
      }
    } catch (err) {
      console.error('save err', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
  goAbsence() { wx.navigateTo({ url: '/pages/docAbsence/docAbsence' }); },
});