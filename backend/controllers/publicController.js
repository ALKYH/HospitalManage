const adminService = require('../services/adminService');

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
