const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const auth = require('../middlewares/authMiddleware');

router.get('/me', auth, patientController.getMyProfile);
router.post('/submit', auth, patientController.submitProfile);

module.exports = router;
