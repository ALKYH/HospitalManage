const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/create', paymentController.createPayment);
router.get('/:id', paymentController.getPayment);
router.post('/:id/pay', paymentController.pay);
router.get('/account/:account_id', paymentController.listByAccount);

module.exports = router;
