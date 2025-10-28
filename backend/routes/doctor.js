const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const auth = require('../middlewares/authMiddleware');
const admin = require('../middlewares/adminMiddleware');

router.get('/', doctorController.list);
router.get('/:id', doctorController.get);
router.get('/:id/availability', doctorController.getAvailability);
router.post('/', auth, admin, doctorController.create);
router.put('/:id', auth, admin, doctorController.update);

module.exports = router;
