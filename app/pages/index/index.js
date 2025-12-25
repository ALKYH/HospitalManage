// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    isLoading: false,
    // banners used by wx:for; keep minimal items to avoid render errors in some devtools
    banners: [1,2,3]
  },
  onLoad() {
    // 可以在此通过接口拉取轮播图，当前使用静态资源占位
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
        url = '/pages/book/book';
        break;
      case '智能分诊':
        url = '/pages/aiChat/aiChat';
        break;
      case '科室简介':
        url = '/pages/deptInfo/deptInfo';
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

