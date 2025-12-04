const express = require('express');
const router = express.Router();
const mqController = require('../controllers/mqController');

router.post('/publish', mqController.publishTest);
router.get('/status', mqController.status);

module.exports = router;
