// utils/request.js
const BASE_URL = (typeof __wxConfigBaseUrl !== 'undefined') ? __wxConfigBaseUrl : "http://172.16.80.20:3000";

/**
 * 通用请求方法，统一后端返回的 success/错误结构
 * options: { url, method, data, headers }
 */
const request = (options) => {
  return new Promise((resolve, reject) => {
    // 自动附带 token（若有）
    const token = wx.getStorageSync('token');
    const defaultHeaders = { 'Content-Type': 'application/json' };
    if (token) defaultHeaders['Authorization'] = `Bearer ${token}`;
    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: Object.assign(defaultHeaders, options.headers || {}),
      success(res) {
        if (res && (res.statusCode === 200 || res.statusCode === 201)) {
          // 约定后端返回 { success: boolean, data?, message? }
          if (res.data && res.data.success === false) {
            return reject({ code: res.statusCode, body: res.data });
          }
          return resolve(res.data);
        }
        // token expired / invalid -> prompt re-login
        if (res && res.statusCode === 401) {
          try {
            wx.removeStorageSync('token');
            wx.showModal({
              title: '登录已过期',
              content: '您的登录已过期，请重新登录以继续使用。',
              confirmText: '去登录',
              showCancel: false,
              success() {
                wx.redirectTo({ url: '/pages/login/login' });
              }
            });
          } catch (e) { /* ignore */ }
          return reject({ code: res.statusCode, body: res.data || res });
        }
        return reject({ code: res.statusCode, body: res.data || res });
      },
      fail(err) {
        return reject({ code: 0, error: err });
      }
    });
  });
};

// convenience: GET with callback or promise
const get = (url, callbacks) => {
  const opts = { url, method: 'GET' };
  if (callbacks && (callbacks.success || callbacks.fail)) {
    request(opts).then(data => callbacks.success && callbacks.success({ data })).catch(err => callbacks.fail && callbacks.fail(err));
    return;
  }
  return request(opts);
};

// convenience: POST with data and callback or promise
const post = (url, data, callbacks) => {
  // signature: post(url, data, callbacks) or post(url, callbacks)
  if (typeof data === 'object' && !callbacks && (data.success || data.fail)) {
    callbacks = data; data = {};
  }
  const opts = { url, method: 'POST', data: data || {} };
  if (callbacks && (callbacks.success || callbacks.fail)) {
    request(opts).then(data => callbacks.success && callbacks.success({ data })).catch(err => callbacks.fail && callbacks.fail(err));
    return;
  }
  return request(opts);
};

module.exports = { request, get, post, BASE_URL };
