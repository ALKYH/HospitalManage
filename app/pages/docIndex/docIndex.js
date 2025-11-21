// pages/docIndex/docIndex.js
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

  },

  goAccount() { wx.navigateTo({ url: '/pages/docAccount/docAccount' }); },
  goRegister() { wx.navigateTo({ url: '/pages/docRegister/docRegister' }); },
  goShift() { wx.navigateTo({ url: '/pages/docShift/docShift' }); },
  goInfo() { wx.navigateTo({ url: '/pages/docInfo/docInfo' }); },
  goAbsence() { wx.navigateTo({ url: '/pages/docAbsence/docAbsence' }); },
  
  onLogout() { 
    wx.removeStorageSync('token'); 
    wx.removeStorageSync('doctor_id'); 
    wx.removeStorageSync('doctor'); 
    wx.removeStorageSync('account_id');
  wx.reLaunch({ url: '/pages/docLogin/docLogin'
 }); },

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