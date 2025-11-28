// pages/profile/profile.js
Page({
    data: {
      userName: '请登录', // 顶部卡片显示的用户名称
      logged: false, // 是否已登录
      isDoctor: false, // 是否为医生登录状态
    },
  
    // 页面加载时调用（仅在初次加载时执行）
    onLoad() { 
      // 主要逻辑放在 onShow 中以确保刷新
    },
  
    // 每次显示页面时都更新登录状态和用户信息
    onShow() {
      // 1. 读取关键缓存数据
      const accountId = wx.getStorageSync('account_id');
      const rawAccountName = wx.getStorageSync('account_name');
      // 假设医生状态标记是布尔值或存在性检查
      // 注意：如果您的后端将 'is_doctor' 存储为字符串 'true'/'false'，您可能需要调整检查逻辑。
      const isDoctor = wx.getStorageSync('is_doctor') === true; 
  
      // 2. 确定登录状态
      const logged = !!accountId;
      
      // 3. 构建展示的用户名
      let displayUserName = '请登录';
  
      if (logged) {
          // 如果已登录，使用缓存的名称，若名称为空则使用默认ID或'已登录用户'
          displayUserName = rawAccountName || `用户ID: ${accountId}` || '已登录用户';
          
          // 如果是医生，添加医生标记
          if (isDoctor) {
            displayUserName += ' (医生)';
          }
      }
  
      // 4. 更新数据
      this.setData({
        logged: logged,
        isDoctor: isDoctor,
        userName: displayUserName
      });
    },
    
    // 下拉刷新事件
    onPullDownRefresh() {
      this.onShow();
      wx.stopPullDownRefresh(); // 停止刷新动画
    },
  
    // 统一处理功能跳转和登录校验
    onClick: function (e) {
      const action = e.currentTarget.dataset.action;
      let url = '';
  
      if (action === '用户登录') {
        // 登录/设置按钮，根据状态跳转
        url = this.data.logged ? '/pages/setting/setting' : '/pages/login/login';
      } else if (action === '医生登录') {
        // 医生登录/登出提示
        if (this.data.logged) {
          this.showLogoutPrompt(); // 提示登出当前账号
          return;
        }
        url = '/pages/docLogin/docLogin';
      } else {
        // 其他需要登录的功能
        if (!this.data.logged) {
          this.showLoginPrompt();
          return;
        }
        switch (action) {
          case '个人信息': url = '/pages/info/info'; break;
          case '我的挂号': url = '/pages/orders/orders'; break;
          case '我的预约': url = '/pages/appointment/appointment'; break;
          default:
            wx.showToast({ title: '功能未定义', icon: 'none' });
            return;
        }
      }
  
      wx.navigateTo({ url });
    },
  
    showLoginPrompt: function () {
      wx.showModal({
        title: '未登录',
        content: '您尚未登录，请先登录以使用完整功能',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
    },
  
    showLogoutPrompt: function () {
      const isDoctor = this.data.isDoctor;
      wx.showModal({
        title: '登出提示',
        content: isDoctor ? '当前为医生账户，确定要登出吗？' : '您已登录，请先登出当前用户才能进行医生登录操作。',
        confirmText: '确定登出',
        success: (res) => {
          if (res.confirm) {
            // 清除所有与用户相关的缓存
            wx.removeStorageSync('token'); 
            wx.removeStorageSync('account_id'); 
            wx.removeStorageSync('account_name'); 
            wx.removeStorageSync('is_doctor'); // 清除医生状态标记
            this.onShow(); // 刷新页面状态
          }
        }
      });
    },
  });