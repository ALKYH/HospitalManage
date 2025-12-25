const express = require('express');
const router = express.Router();
const controller = require('../controllers/registrationController');
const auth = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/registration/create:
 *   post:
 *     tags: [挂号]
 *     summary: 创建挂号预约
 *     description: |
 *       患者创建挂号预约，可选择指定医生或科室
 *       
 *       **注意：**
 *       1. 创建成功后，会在 orders 表中创建对应的记录
 *       2. account_id 自动从登录用户获取，无需手动传入
 *       3. 如果指定医生，会检查 doctor_availability 表是否有可用号源
 *       4. 如果只有科室，会进入候补状态（is_waitlist=true）
 *       5. 创建成功后会生成 order_history 记录
 *       
 *       **挂号类型（regi_type）：**
 *       - 普通号: 0元
 *       - 专家号: 20元  
 *       - 特需号: 50元
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [department_id, doctor_id, date, slot]
 *             properties:
 *               department_id:
 *                 type: integer
 *                 example: 3
 *                 description: "科室ID"
 *               doctor_id:
 *                 type: integer
 *                 example: 5
 *                 description: "医生ID"
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-20"
 *                 description: "预约日期"
 *               slot:
 *                 type: string
 *                 enum: [8-10, 10-12, 14-16, 16-18]
 *                 example: "8-10"
 *                 description: "时间段"
 *               note:
 *                 type: string
 *                 maxLength: 500
 *                 example: "最近有咳嗽症状"
 *                 description: "病情备注"
 *               regi_type:
 *                 type: string
 *                 enum: [普通号, 专家号, 特需号]
 *                 default: "普通号"
 *                 description: "挂号类型"
 *               force_waitlist:
 *                 type: boolean
 *                 default: false
 *                 description: "是否强制加入候补（测试用）"
 *               symptoms:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["咳嗽", "发烧", "头痛"]
 *                 description: "症状描述"
 *     responses:
 *       201:
 *         description: 挂号预约创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "挂号成功"
 *               data:
 *                 id: 8
 *                 account_id: 10
 *                 doctor_id: 5
 *                 department_id: 3
 *                 availability_id: 50
 *                 date: "2024-01-20"
 *                 slot: "8-10"
 *                 is_waitlist: false
 *                 priority: 0
 *                 status: "confirmed"
 *                 queue_number: null
 *                 note: "最近有咳嗽症状"
 *                 payment_id: null
 *                 created_at: "2024-01-15T10:30:00Z"
 *                 updated_at: "2024-01-15T10:30:00Z"
 *               payment:
 *                 id: 5
 *                 amount: 20.00
 *                 status: "created"
 *               payment_required: true
 *       400:
 *         description: 参数错误或号源不足
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "缺少必要参数"
 *               code: 400
 *               details:
 *                 - field: "doctor_id"
 *                   message: "医生ID不能为空"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 权限不足
 *       409:
 *         description: 同一时间段已有预约或冲突
 */
router.post('/create', controller.createRegistration);

/**
 * @swagger
 * /api/registration/list/{user_id}:
 *   get:
 *     tags: [挂号]
 *     summary: 获取用户所有挂号记录
 *     description: |
 *       获取指定用户的所有挂号记录（包括正式预约和候补）
 *       
 *       **注意：** 
 *       1. 此接口会查询 orders 表和关联表
 *       2. 候补订单会显示候补进度 (wait_position) 和当天候补总数 (wait_total)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: user_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: "用户ID"
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/dateParam'
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, waiting, cancelled, completed]
 *         description: 按状态筛选
 *       - name: include_waitlist
 *         in: query
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否包含候补记录
 *       - name: doctor_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: 按医生ID筛选
 *       - name: department_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: 按科室ID筛选
 *     responses:
 *       200:
 *         description: 成功获取挂号记录
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               data: [
 *                 {
 *                   id: 8,
 *                   date: "2024-01-20",
 *                   slot: "8-10",
 *                   doctor_id: 5,
 *                   doctor_name: "张医生",
 *                   department_id: 3,
 *                   department_name: "内科",
 *                   status: "confirmed",
 *                   is_waitlist: false,
 *                   queue_number: 3,
 *                   payment_id: 5,
 *                   payment_amount: 20.00,
 *                   payment_status: "paid",
 *                   payment_paid_at: "2024-01-15T10:31:00Z",
 *                   wait_position: 0,
 *                   wait_total: 0,
 *                   created_at: "2024-01-15T10:30:00Z"
 *                 },
 *                 {
 *                   id: 9,
 *                   date: "2024-01-21",
 *                   slot: "10-12",
 *                   department_id: 4,
 *                   department_name: "呼吸内科",
 *                   status: "waiting",
 *                   is_waitlist: true,
 *                   priority: 2,
 *                   payment_id: null,
 *                   payment_amount: null,
 *                   payment_status: null,
 *                   wait_position: 2,
 *                   wait_total: 5,
 *                   created_at: "2024-01-15T11:30:00Z"
 *                 }
 *               ]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 只能查看自己的挂号记录
 */
router.get('/list/:user_id', controller.listByUser);

/**
 * @swagger
 * /api/registration/orders/{user_id}:
 *   get:
 *     tags: [挂号]
 *     summary: 获取用户正式订单
 *     description: |
 *       获取指定用户的正式挂号订单（不含候补预约）
 *       
 *       **注意：** 此接口会过滤掉 is_waitlist = 1 或 status = 'waiting' 的记录
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: user_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: "用户ID"
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/dateParam'
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, cancelled, completed]
 *         description: 按状态筛选
 *       - name: upcoming
 *         in: query
 *         schema:
 *           type: boolean
 *         description: "是否只显示即将到来的预约（date >= 今天）"
 *       - name: with_payment
 *         in: query
 *         schema:
 *           type: boolean
 *         description: "是否包含支付信息"
 *     responses:
 *       200:
 *         description: 成功获取订单列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               data: [
 *                 {
 *                   id: 8,
 *                   date: "2024-01-20",
 *                   slot: "8-10",
 *                   doctor_id: 5,
 *                   doctor_name: "张医生",
 *                   department_id: 3,
 *                   department_name: "内科",
 *                   status: "confirmed",
 *                   is_waitlist: false,
 *                   queue_number: 3,
 *                   payment_id: 5,
 *                   payment_amount: 20.00,
 *                   payment_status: "paid",
 *                   payment_paid_at: "2024-01-15T10:31:00Z",
 *                   created_at: "2024-01-15T10:30:00Z"
 *                 },
 *                 {
 *                   id: 10,
 *                   date: "2024-01-22",
 *                   slot: "14-16",
 *                   doctor_id: 6,
 *                   doctor_name: "李医生",
 *                   department_id: 4,
 *                   department_name: "外科",
 *                   status: "completed",
 *                   payment_id: 6,
 *                   payment_amount: 20.00,
 *                   payment_status: "paid",
 *                   created_at: "2024-01-16T09:30:00Z"
 *                 }
 *               ]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 只能查看自己的订单
 */
router.get('/orders/:user_id', controller.listOrdersByUser);

// 获取当前登录患者的所有挂号（含医生信息与医生填写的 note）
router.get('/my-registrations', auth, controller.myRegistrations);

/**
 * @swagger
 * /api/registration/update-status:
 *   post:
 *     tags: [挂号]
 *     summary: 更新挂号状态
 *     description: |
 *       更新挂号订单的状态（管理员或系统使用）
 *       
 *       **注意：** 状态变更会记录到 order_history 表中
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_id, new_status]
 *             properties:
 *               order_id:
 *                 type: integer
 *                 format: int64
 *                 example: 8
 *               new_status:
 *                 type: string
 *                 enum: [pending, confirmed, waiting, cancelled, completed]
 *                 example: "confirmed"
 *               action_by:
 *                 type: integer
 *                 example: 1
 *                 description: "操作人ID（管理员）"
 *               comment:
 *                 type: string
 *                 example: "系统自动确认"
 *                 description: "状态变更说明"
 *     responses:
 *       200:
 *         description: 状态更新成功
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "状态更新成功"
 *               data:
 *                 order_id: 8
 *                 old_status: "pending"
 *                 new_status: "confirmed"
 *                 # 记录到 order_history
 *                 history_id: 11
 *                 updated_at: "2024-01-15T10:35:00Z"
 *       400:
 *         description: 参数错误或状态转换无效
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 需要管理员权限
 *       404:
 *         description: 订单不存在
 */
router.post('/update-status', controller.updateStatus);

/**
 * @swagger
 * /api/registration/cancel:
 *   post:
 *     tags: [挂号]
 *     summary: 取消挂号
 *     description: |
 *       患者取消自己的挂号预约
 *       
 *       **注意：**
 *       1. 会更新 orders 表的 status 为 cancelled
 *       2. 会在 order_history 中记录取消操作
 *       3. 如果有支付记录，可能需要处理退款
 *       4. account_id 自动从登录用户获取，无需手动传入
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_id]
 *             properties:
 *               order_id:
 *                 type: integer
 *                 format: int64
 *                 example: 8
 *               reason:
 *                 type: string
 *                 example: "临时有事无法就诊"
 *                 description: "取消原因"
 *               refund_payment:
 *                 type: boolean
 *                 default: true
 *                 description: "是否自动退款"
 *     responses:
 *       200:
 *         description: 取消成功
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "挂号已取消"
 *               data:
 *                 order_id: 8
 *                 old_status: "confirmed"
 *                 new_status: "cancelled"
 *                 # 如果有支付
 *                 payment_id: 5
 *                 refund_amount: 20.00
 *                 refund_status: "pending"
 *                 # 记录到 order_history
 *                 history_id: 12
 *                 cancelled_at: "2024-01-15T11:30:00Z"
 *       400:
 *         description: 参数错误或订单无法取消
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "就诊时间已过，无法取消"
 *               code: 400
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: 只能取消自己的挂号
 *       404:
 *         description: 订单不存在
 */
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

/**
 * 医生编辑病历（订单 note 字段）
 * 请求体: { order_id, note }
 */
router.post('/edit-note', auth, controller.editNote);

module.exports = router;