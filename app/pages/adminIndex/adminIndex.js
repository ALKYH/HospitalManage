const { request } = require('../../utils/request');
Page({
  data: {},
  onLoad() {},
  goDoctors() { wx.navigateTo({ url: '/pages/adminDoctors/adminDoctors' }); },
  goAccounts() { wx.navigateTo({ url: '/pages/adminAccounts/adminAccounts' }); }
});
