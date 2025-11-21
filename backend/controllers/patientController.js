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
    // 必填校验：需提供学/工号、姓名、身份证号与手机号
    const employeeId = payload.employeeId || payload.idNumber || (payload.extra && payload.extra.employeeId) || null;
    const name = payload.display_name || null;
    const idNumber = payload.idcard || payload.idNumber || (payload.extra && payload.extra.idNumber) || null;
    const phone = payload.phone || (payload.extra && payload.extra.phone) || null;

    if (!employeeId || !name || !idNumber) {
      return res.status(400).json({ success: false, message: '需提供学/工号、姓名和身份证号' });
    }

    // 手机必须为 11 位数字
    if (!phone || !/^\d{11}$/.test(String(phone))) {
      return res.status(400).json({ success: false, message: '手机号需为11位数字' });
    }

    // 严格匹配 staff 列表：三字段必须与同一条记录对应
    const verified = patientService.verifyAgainstStaffList({ employeeId, name, idNumber });
    if (!verified) {
      return res.status(400).json({ success: false, message: '信息与教职工名单不匹配，请核对学/工号、姓名和身份证号' });
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
