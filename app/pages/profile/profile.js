// pages/profile/profile.js
Page({
  data: {
    id_top: '',
    logged: false, // 建议用布尔类型
  },

  onClick: function (e) {
    const action = e.currentTarget.dataset.action;
    let url = '';

    switch (action) {
      case '用户登录':
        if (!wx.getStorageSync('account_id')) {
          url = '/pages/login/login';
        } else {
          url = '/pages/setting/setting';
        }
        break;

      case '个人信息':
        if (!this.data.logged) {
          this.showLoginPrompt();
          return;
        }
        url = '/pages/info/info';
        break;

      case '我的挂号':
        if (!this.data.logged) {
          this.showLoginPrompt();
          return;
        }
        url = '/pages/orders/orders';
        break;

      case '我的预约':
        if (!this.data.logged) {
          this.showLoginPrompt();
          return;
        }
        url = '/pages/appointment/appointment';
        break;

        case '医生登录':
          url = '/pages/docLogin/docLogin';
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

  showLoginPrompt: function () {
    wx.showModal({
      title: '提示',
      content: '请先登录',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }
      }
    });
  },

  onLoad() {
    this.setData({
      logged: Boolean(wx.getStorageSync('account_id'))
    });
  },

  onShow() {
    // 每次显示页面时都更新登录状态
    const accountId = wx.getStorageSync('account_id');
    const accountName = wx.getStorageSync('account_name');
    this.setData({
      logged: Boolean(accountId),
      id_top: accountName || ''
    });
  },
});
