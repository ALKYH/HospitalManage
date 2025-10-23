const express = require('express');
const router = express.Router();
const controller = require('../controllers/registrationController');

router.post('/create', controller.createRegistration);
router.get('/list/:user_id', controller.listByUser);
router.post('/update-status', controller.updateStatus);

module.exports = router;
