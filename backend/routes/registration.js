const express = require('express');
const router = express.Router();
const controller = require('../controllers/registrationController');

router.post('/create', controller.createRegistration);
router.get('/list/:user_id', controller.listByUser);
// 新增：仅订单（不含候补预约）
router.get('/orders/:user_id', controller.listOrdersByUser);
router.post('/update-status', controller.updateStatus);
router.post('/cancel', async (req, res) => {
	try {
		const { order_id, cancelled_by } = req.body;
		if (!order_id) return res.status(400).json({ success: false, message: 'missing order_id' });
		const registrationService = require('../services/registrationService');
		await registrationService.cancelRegistration(order_id, cancelled_by || null);
		res.json({ success: true });
	} catch (err) {
		console.error('cancel route err', err);
		res.status(500).json({ success: false, message: err.message });
	}
});

module.exports = router;
