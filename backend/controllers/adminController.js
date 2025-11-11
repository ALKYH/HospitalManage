const adminService = require('../services/adminService');

exports.listDepartments = async (req, res) => {
  try {
    const rows = await adminService.listDepartments();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createDepartment = async (req, res) => {
  try {
    const row = await adminService.createDepartment(req.body);
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateDepartment = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.updateDepartment(id, req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.deleteDepartment(id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Doctors
exports.listDoctors = async (req, res) => {
  try {
    const rows = await adminService.listDoctors(req.query);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createDoctor = async (req, res) => {
  try {
    const row = await adminService.createDoctor(req.body);
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateDoctor = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.updateDoctor(id, req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteDoctor = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.deleteDoctor(id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Availability
exports.getAvailabilityByDoctor = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    const rows = await adminService.getAvailabilityByDoctor(doctorId);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createOrUpdateAvailability = async (req, res) => {
  try {
    const row = await adminService.createOrUpdateAvailability(req.body);
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.listAllAvailability = async (req, res) => {
  try {
    const rows = await adminService.listAllAvailability();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteAvailability = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.deleteAvailability(id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Fees
exports.listFees = async (req, res) => {
  try {
    const rows = await adminService.listFees();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.setFee = async (req, res) => {
  try {
    const row = await adminService.setFee(req.body);
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Doctor profile reviews
exports.listPendingDoctorReviews = async (req, res) => {
  try {
    const rows = await adminService.listPendingDoctorReviews();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.approveDoctorProfile = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    await adminService.approveDoctorProfile(doctorId, req.user.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.rejectDoctorProfile = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    const { comment } = req.body || {};
    await adminService.rejectDoctorProfile(doctorId, req.user.id, comment);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Leave requests
exports.listLeaveRequests = async (req, res) => {
  try {
    const rows = await adminService.listLeaveRequests();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.approveLeaveRequest = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.setLeaveRequestStatus(id, 'approved', req.user.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.rejectLeaveRequest = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.setLeaveRequestStatus(id, 'rejected', req.user.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
