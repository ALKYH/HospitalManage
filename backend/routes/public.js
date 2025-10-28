const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

router.get('/departments', publicController.listDepartmentsTree);

module.exports = router;
