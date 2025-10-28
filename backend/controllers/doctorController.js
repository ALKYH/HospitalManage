const doctorService = require('../services/doctorService');

exports.create = async (req, res) => {
  try {
    const payload = req.body || {};
    const created = await doctorService.createDoctor(payload);
    res.json({ success: true, data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await doctorService.getDoctorById(id);
    if (!doc) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const filters = {};
    if (req.query && req.query.department_id) filters.department_id = req.query.department_id;
    const rows = await doctorService.listDoctors(filters);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const updated = await doctorService.updateDoctor(id, req.body || {});
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAvailability = async (req, res) => {
  try {
    const id = req.params.id;
    const date = req.query.date || null;
    const rows = await doctorService.getAvailabilityByDoctor(id, date);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};
