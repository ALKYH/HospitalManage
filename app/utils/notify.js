// notify.js
const { request } = require('./request');

/**
 * Request subscription for templates and register choice with backend
 * templateIds: array of template ids to request via wx.requestSubscribeMessage
 */
async function requestSubscription(templateIds = []) {
  return new Promise((resolve, reject) => {
    if (!wx.requestSubscribeMessage) {
      return resolve({ success: false, message: '不支持 requestSubscribeMessage' });
    }
    wx.requestSubscribeMessage({
      tmplIds: templateIds,
      success: async (res) => {
        // res is an object mapping tmplId -> 'accept'|'reject'|'ban'
        try {
          // send subscription decision to backend (backend will store opt-in flag)
          const accountId = wx.getStorageSync('account_id');
          // we may not have openid from client; backend can later map account->openid via login flow
          await request({ url: '/api/notify/subscribe', method: 'POST', data: { notify_opt_in: true } });
        } catch (err) { /* ignore backend store errors for now */ }
        resolve({ success: true, detail: res });
      },
      fail(err) { reject(err); }
    });
  });
}

module.exports = { requestSubscription };
