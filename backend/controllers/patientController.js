const patientService = require('../services/patientService');

exports.getMyProfile = async (req, res) => {
  try {
    const accountId = req.user && req.user.id;
    if (!accountId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const profile = await patientService.getProfileByAccountId(accountId);
    // 将数据库中存储的性别枚举(M/F)映射回中文，方便前端显示
    if (profile && profile.gender) {
      if (profile.gender === 'M') profile.gender = '男';
      else if (profile.gender === 'F') profile.gender = '女';
    }
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitProfile = async (req, res) => {
  try {
    const accountId = req.user && req.user.id;
    if (!accountId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const payload = req.body || {};

    // 验证表单必填项
    if (!payload.idcard && !payload.idNumber) {
      return res.status(400).json({ success: false, message: '需提供身份证号或工号以验证' });
    }

    // 验证是否在教职工名单中（使用学工号(employeeId)/姓名/身份证三项中的任何一项）
    const verified = patientService.verifyAgainstStaffList({
      employeeId: payload.idNumber || payload.employeeId || null,
      name: payload.display_name || null,
      idNumber: payload.idNumber || payload.idcard || null
    });
    if (!verified) {
      return res.status(400).json({ success: false, message: '未在教职工名单中，请核对信息' });
    }

    const saved = await patientService.saveProfile(accountId, payload);
    // 将保存结果的性别映射回中文以便前端直接显示
    if (saved && saved.gender) {
      if (saved.gender === 'M') saved.gender = '男';
      else if (saved.gender === 'F') saved.gender = '女';
    }
    res.json({ success: true, data: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};
