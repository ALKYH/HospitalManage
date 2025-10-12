// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {},
  onLoad() {},
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
  }
});

