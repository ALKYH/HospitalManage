const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const auth = require('../middlewares/authMiddleware');
const admin = require('../middlewares/adminMiddleware');

router.get('/', doctorController.list);
router.get('/me', require('../middlewares/authMiddleware'), doctorController.getMyDoctor);
router.put('/me', require('../middlewares/authMiddleware'), doctorController.updateMe);
router.get('/me/registrations', require('../middlewares/authMiddleware'), doctorController.getRegistrationsForMe);
router.post('/me/availability', require('../middlewares/authMiddleware'), doctorController.upsertAvailabilityForMe);
router.delete('/me/availability/:id', require('../middlewares/authMiddleware'), doctorController.deleteAvailabilityForMe);
router.post('/me/leave', require('../middlewares/authMiddleware'), doctorController.createLeaveRequest);
router.post('/', auth, admin, doctorController.create);
router.put('/:id', auth, admin, doctorController.update);
router.get('/:id', doctorController.get);
router.get('/:id/availability', doctorController.getAvailability);
router.get('/:id/registrations', require('../middlewares/authMiddleware'), doctorController.getRegistrationsByDoctorId);

module.exports = router;
