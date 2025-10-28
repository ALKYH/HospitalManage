const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/adminMiddleware');

// All admin APIs require auth + admin
router.use(auth, isAdmin);

// Departments
router.get('/departments', adminController.listDepartments);
router.post('/departments', adminController.createDepartment);
router.put('/departments/:id', adminController.updateDepartment);
router.delete('/departments/:id', adminController.deleteDepartment);

// Doctors
router.get('/doctors', adminController.listDoctors);
router.post('/doctors', adminController.createDoctor);
router.put('/doctors/:id', adminController.updateDoctor);
router.delete('/doctors/:id', adminController.deleteDoctor);

// Availability (capacities per service type are stored in extra JSON)
router.get('/availability/:doctorId', adminController.getAvailabilityByDoctor);
router.post('/availability', adminController.createOrUpdateAvailability);

// Fees
router.get('/fees', adminController.listFees);
router.post('/fees', adminController.setFee);

// Doctor profile reviews
router.get('/doctor-reviews/pending', adminController.listPendingDoctorReviews);
router.post('/doctor-reviews/:doctorId/approve', adminController.approveDoctorProfile);
router.post('/doctor-reviews/:doctorId/reject', adminController.rejectDoctorProfile);

// Leave requests
router.get('/leave-requests', adminController.listLeaveRequests);
router.post('/leave-requests/:id/approve', adminController.approveLeaveRequest);
router.post('/leave-requests/:id/reject', adminController.rejectLeaveRequest);

module.exports = router;
