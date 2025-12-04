const express = require('express');
const router = express.Router();
const notifyController = require('../controllers/notifyController');
const auth = require('../middlewares/authMiddleware');

router.post('/subscribe', auth, notifyController.subscribe);

module.exports = router;
