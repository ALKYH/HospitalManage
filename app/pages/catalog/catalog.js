// pages/catalog/catalog.js
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
  onClick: function(e) {
    const action = e.currentTarget.dataset.action;
    // 根据 action 跳转不同页面
    let url = '';
    switch(action) {
      case '挂号':
        url = '/pages/register/register';
        break;
      case '查询':
        url = '/pages/docProfile/docProfile';
        break;
      case '预约':
        url = '/pages/appointment/appointment';
        break;
      case '健康档案':
        url = '/pages/health/health';
      
        break;
      default:
        wx.showToast({
          title: '功能未定义',
          icon: 'none'
        });
        return;
    }
    wx.navigateTo({ url });
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