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
router.post('/doctors/:id/set-password', adminController.setDoctorPassword);

// Accounts (admin)
router.get('/accounts', adminController.listAccounts);
router.get('/accounts/:id', adminController.getAccount);
router.put('/accounts/:id', adminController.updateAccount);
router.delete('/accounts/:id', adminController.deleteAccount);

// Availability (capacities per service type are stored in extra JSON)
router.get('/availability', adminController.listAllAvailability); // list all availabilities
router.get('/availability/:doctorId', adminController.getAvailabilityByDoctor);
router.post('/availability', adminController.createOrUpdateAvailability);
router.delete('/availability/:id', adminController.deleteAvailability);

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

// Debug: show all tables and basic metadata
router.get('/tables', adminController.listAllTables);
// Orders view for admin
router.get('/orders', adminController.listOrders);

// Account management
router.get('/accounts', adminController.listAccounts);
router.get('/accounts/:id', adminController.getAccount);
router.put('/accounts/:id', adminController.updateAccount);
router.delete('/accounts/:id', adminController.deleteAccount);

module.exports = router;
