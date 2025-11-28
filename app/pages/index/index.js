// index.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    isLoading: true, // 控制骨架屏状态
    // 轮播图数据（可扩展）
    banners: [
      '../../assets/header.jpg',
      '../../assets/header2.jpg',
      '../../assets/header3.jpg'
    ]
  },

  onLoad() {
    // 模拟数据加载，展示骨架屏动画 1.5秒
    setTimeout(() => {
      this.setData({ isLoading: false });
    }, 1500);
  },

  onClick: function(e) {
    // 防止加载中误触
    if (this.data.isLoading) return;

    const action = e.currentTarget.dataset.action;
    let url = '';
    
    // 添加震动反馈，提升触感
    wx.vibrateShort({ type: 'light' });

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
      case '健康档案':
        url = '/pages/health/health';
        break;
      case '医生登录':
        // 示例：区分不同的医生登录入口或做相同处理
        url = '/pages/doctor/login';
        break;
      default:
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
        return;
    }
    
    if(url) {
      wx.navigateTo({ url });
    }
  }
});