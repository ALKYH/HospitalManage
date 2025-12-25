// pages/Case/Case.js
const { request } = require('../../utils/request');

Page({
  data: {
    registrations: [],
    order: null,
    noteText: '',
    saving: false,
    selectedLabel: ''
  },

  onLoad(options) {
    // if navigated with order_id, remember it
    this._initialOrderId = options && options.order_id ? options.order_id : null;
  },

  onShow() {
    this.loadRegistrations();
  },

  async loadRegistrations() {
    this.setData({ loading: true });
    try {
      const res = await request({ url: '/api/doctor/me/registrations', method: 'GET' });
      if (res && res.success) {
        const regs = (res.data || []).map(r => ({
          id: r.id,
          label: `#${r.id} ${r.patient_name||r.account_username} ${r.date} ${r.slot}`,
          raw: r
        }));
        this.setData({ registrations: regs });
        // if initial order id provided, select it
        if (this._initialOrderId) {
          const found = regs.find(x => String(x.id) === String(this._initialOrderId));
          if (found) {
            this.selectRegistrationById(found.id);
            return;
          }
        }
        // if there is at least one, preselect first
        if (regs.length > 0 && !this.data.order) {
          this.selectRegistrationById(regs[0].id);
        }
      } else {
        wx.showToast({ title: (res && res.message) || '获取失败', icon: 'none' });
      }
    } catch (err) {
      console.error('loadRegistrations err', err);
      wx.showToast({ title: '网络或服务错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onPickRegistration(e) {
    const idx = e.detail.value;
    const sel = (this.data.registrations || [])[idx];
    if (sel) this.selectRegistrationById(sel.id);
  },

  selectRegistrationById(id) {
    const sel = (this.data.registrations || []).find(r => String(r.id) === String(id));
    if (!sel) return;
    const order = sel.raw;
    this.setData({ order, noteText: order.note || '', selectedLabel: sel.label });
  },

  onNoteInput(e) {
    this.setData({ noteText: e.detail.value });
  },

  async saveNote() {
    const order = this.data.order;
    if (!order) return wx.showToast({ title: '请先选择挂号单', icon: 'none' });
    this.setData({ saving: true });
    try {
      const res = await request({ url: '/api/registration/edit-note', method: 'POST', data: { order_id: order.id, note: this.data.noteText } });
      if (res && res.success) {
        wx.showToast({ title: '保存成功' });
        // update local copy
        this.setData({ order: res.data, noteText: res.data.note || '' });
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' });
      }
    } catch (err) {
      console.error('saveNote err', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});