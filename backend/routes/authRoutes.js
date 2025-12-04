const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/change-password', require('../middlewares/authMiddleware'), AuthController.changePassword);

module.exports = router;
