const adminService = require('../services/adminService');
const fs = require('fs');
const path = require('path');

function readJsonFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('readJsonFileSafe err', err);
    return null;
  }
}

// 返回两级科室树：[{ id, name, children: [{id,name}, ...] }, ...]
exports.listDepartmentsTree = async (req, res) => {
  try {
    const rows = await adminService.listDepartments();
    // rows: array with parent_id possibly null
    const map = {};
    rows.forEach(r => { map[r.id] = Object.assign({}, r, { children: [] }); });
    const roots = [];
    rows.forEach(r => {
      if (r.parent_id) {
        if (map[r.parent_id]) map[r.parent_id].children.push(map[r.id]);
      } else {
        roots.push(map[r.id]);
      }
    });
    res.json({ success: true, data: roots });
  } catch (err) {
    console.error('listDepartmentsTree', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 返回科室介绍（从 backend/data/department-intros.json 中查找 id）
exports.getDepartmentIntro = async (req, res) => {
  try {
    const id = req.params.id;
    const dataFile = path.join(__dirname, '..', 'data', 'department-intros.json');
    const all = readJsonFileSafe(dataFile) || [];
    const found = all.find(d => String(d.id) === String(id));
    if (!found) return res.status(404).json({ success: false, message: 'Department intro not found' });
    res.json({ success: true, data: found });
  } catch (err) {
    console.error('getDepartmentIntro err', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 返回医生介绍（从 backend/data/doctor-intros.json 中查找 id）
exports.getDoctorIntro = async (req, res) => {
  try {
    const id = req.params.id;
    const dataFile = path.join(__dirname, '..', 'data', 'doctor-intros.json');
    const all = readJsonFileSafe(dataFile) || [];
    const found = all.find(d => String(d.id) === String(id));
    if (!found) return res.status(404).json({ success: false, message: 'Doctor intro not found' });
    res.json({ success: true, data: found });
  } catch (err) {
    console.error('getDoctorIntro err', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
