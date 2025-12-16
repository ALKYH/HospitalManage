const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/adminMiddleware');

// All admin APIs require auth + admin
router.use(auth, isAdmin);

/**
 * @swagger
 * /api/admin/departments:
 *   get:
 *     tags: [管理员]
 *     summary: 获取所有科室列表
 *     description: 管理员获取所有科室信息，支持分页
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - name: parent_id
 *         in: query
 *         schema:
 *           type: integer
 *           nullable: true
 *         description: 父级科室ID，null表示一级科室
 *     responses:
 *       200:
 *         description: 成功获取科室列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/departments', adminController.listDepartments);

/**
 * @swagger
 * /api/admin/departments:
 *   post:
 *     tags: [管理员]
 *     summary: 创建科室
 *     description: 管理员创建新的科室
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "内科"
 *               code:
 *                 type: string
 *                 example: "NEIKE"
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *                 description: "父科室ID，null表示一级科室"
 *     responses:
 *       201:
 *         description: 科室创建成功
 *       400:
 *         description: 参数错误
 *       409:
 *         description: 科室代码已存在
 */
router.post('/departments', adminController.createDepartment);

/**
 * @swagger
 * /api/admin/departments/{id}:
 *   put:
 *     tags: [管理员]
 *     summary: 更新科室信息
 *     description: 管理员更新科室信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 科室ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 科室不存在
 */
router.put('/departments/:id', adminController.updateDepartment);

/**
 * @swagger
 * /api/admin/departments/{id}:
 *   delete:
 *     tags: [管理员]
 *     summary: 删除科室
 *     description: 管理员删除科室（如果科室下有医生或子科室则无法删除）
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 科室ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       400:
 *         description: 科室下有相关数据，无法删除
 *       404:
 *         description: 科室不存在
 */
router.delete('/departments/:id', adminController.deleteDepartment);

/**
 * @swagger
 * /api/admin/doctors:
 *   get:
 *     tags: [管理员]
 *     summary: 获取医生列表（管理）
 *     description: 管理员获取所有医生信息，支持分页和筛选
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - name: department_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: 按科室筛选
 *       - name: approved
 *         in: query
 *         schema:
 *           type: boolean
 *         description: 按审核状态筛选
 *     responses:
 *       200:
 *         description: 成功获取医生列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/doctors', adminController.listDoctors);

// Statistics
router.get('/stats/registrations', adminController.registrationsStats);
router.get('/stats/refund-rate', adminController.refundRate);
router.get('/stats/schedule-calendar', adminController.scheduleCalendar);
router.get('/departments/tree', adminController.departmentsTree);

/**
 * @swagger
 * /api/admin/doctors:
 *   post:
 *     tags: [管理员]
 *     summary: 创建医生（管理）
 *     description: 管理员创建医生账户，可关联已有账户
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, department_id]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "王医生"
 *               department_id:
 *                 type: integer
 *                 example: 3
 *               account_id:
 *                 type: integer
 *                 example: 100
 *                 description: "关联的用户账户ID（可选）"
 *               title:
 *                 type: string
 *                 example: "主任医师"
 *               bio:
 *                 type: string
 *                 example: "专业简介..."
 *               contact:
 *                 type: string
 *                 example: "13800138000"
 *     responses:
 *       201:
 *         description: 医生创建成功
 *       400:
 *         description: 参数错误
 *       404:
 *         description: 关联账户不存在
 */
router.post('/doctors', adminController.createDoctor);

/**
 * @swagger
 * /api/admin/doctors/{id}:
 *   put:
 *     tags: [管理员]
 *     summary: 更新医生信息（管理）
 *     description: 管理员更新医生信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 医生ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               department_id:
 *                 type: integer
 *               title:
 *                 type: string
 *               bio:
 *                 type: string
 *               contact:
 *                 type: string
 *               account_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 医生不存在
 */
router.put('/doctors/:id', adminController.updateDoctor);

/**
 * @swagger
 * /api/admin/doctors/{id}:
 *   delete:
 *     tags: [管理员]
 *     summary: 删除医生（管理）
 *     description: 管理员删除医生账户
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 医生ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 医生不存在
 *       400:
 *         description: 医生有待处理的预约，无法删除
 */
router.delete('/doctors/:id', adminController.deleteDoctor);

/**
 * @swagger
 * /api/admin/doctors/{id}/set-password:
 *   post:
 *     tags: [管理员]
 *     summary: 设置医生账户密码
 *     description: 管理员为医生账户设置或重置密码
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 医生ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: 密码设置成功
 *       404:
 *         description: 医生不存在或未关联账户
 */
router.post('/doctors/:id/set-password', adminController.setDoctorPassword);

/**
 * @swagger
 * /api/admin/accounts:
 *   get:
 *     tags: [管理员]
 *     summary: 获取账户列表
 *     description: 管理员获取所有用户账户列表
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - name: role
 *         in: query
 *         schema:
 *           type: string
 *           enum: [user, doctor, admin]
 *         description: 按角色筛选
 *       - name: username
 *         in: query
 *         schema:
 *           type: string
 *         description: 按用户名搜索
 *     responses:
 *       200:
 *         description: 成功获取账户列表
 */
router.get('/accounts', adminController.listAccounts);

/**
 * @swagger
 * /api/admin/accounts/{id}:
 *   get:
 *     tags: [管理员]
 *     summary: 获取账户详情
 *     description: 管理员获取指定账户的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 账户ID
 *     responses:
 *       200:
 *         description: 成功获取账户信息
 *       404:
 *         description: 账户不存在
 */
router.get('/accounts/:id', adminController.getAccount);

/**
 * @swagger
 * /api/admin/accounts/{id}:
 *   put:
 *     tags: [管理员]
 *     summary: 更新账户信息
 *     description: 管理员更新用户账户信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 账户ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [user, doctor, admin]
 *               is_active:
 *                 type: boolean
 *                 description: 账户是否激活
 *     responses:
 *       200:
 *         description: 更新成功
 *       409:
 *         description: 用户名已存在
 */
router.put('/accounts/:id', adminController.updateAccount);

/**
 * @swagger
 * /api/admin/accounts/{id}:
 *   delete:
 *     tags: [管理员]
 *     summary: 删除账户
 *     description: 管理员删除用户账户（谨慎操作）
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 账户ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       400:
 *         description: 账户有相关数据，无法删除
 */
router.delete('/accounts/:id', adminController.deleteAccount);

/**
 * @swagger
 * /api/admin/availability:
 *   get:
 *     tags: [管理员]
 *     summary: 获取所有排班列表
 *     description: 管理员获取所有医生的排班信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/dateParam'
 *       - name: doctor_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: 按医生筛选
 *       - name: is_available
 *         in: query
 *         schema:
 *           type: boolean
 *         description: 按是否可用筛选
 *     responses:
 *       200:
 *         description: 成功获取排班列表
 */
router.get('/availability', adminController.listAllAvailability);

/**
 * @swagger
 * /api/admin/availability/{doctorId}:
 *   get:
 *     tags: [管理员]
 *     summary: 获取医生排班（管理）
 *     description: 管理员获取指定医生的所有排班
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: doctorId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 医生ID
 *       - $ref: '#/components/parameters/dateParam'
 *     responses:
 *       200:
 *         description: 成功获取排班信息
 */
router.get('/availability/:doctorId', adminController.getAvailabilityByDoctor);

/**
 * @swagger
 * /api/admin/availability:
 *   post:
 *     tags: [管理员]
 *     summary: 创建或更新排班（管理）
 *     description: 管理员为医生创建或更新排班信息
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [doctor_id, date, slot]
 *             properties:
 *               doctor_id:
 *                 type: integer
 *                 example: 5
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-20"
 *               slot:
 *                 type: string
 *                 enum: [8-10, 10-12, 14-16, 16-18]
 *                 example: "8-10"
 *               capacity:
 *                 type: integer
 *                 minimum: 1
 *                 default: 20
 *               extra:
 *                 type: object
 *                 description: 扩展信息
 *     responses:
 *       200:
 *         description: 操作成功
 *       404:
 *         description: 医生不存在
 *       409:
 *         description: 时间段冲突
 */
router.post('/availability', adminController.createOrUpdateAvailability);

/**
 * @swagger
 * /api/admin/availability/{id}:
 *   delete:
 *     tags: [管理员]
 *     summary: 删除排班（管理）
 *     description: 管理员删除医生的排班
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 排班ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 排班不存在
 *       400:
 *         description: 排班已有预约，无法删除
 */
router.delete('/availability/:id', adminController.deleteAvailability);

/**
 * @swagger
 * /api/admin/fees:
 *   get:
 *     tags: [管理员]
 *     summary: 获取费用设置列表
 *     description: |
 *       管理员获取挂号费用设置
 *       
 *       **费用目标类型：**
 *       - `global`: 全局默认费用
 *       - `department`: 科室特定费用
 *       - `doctor`: 医生特定费用
 *       
 *       **注意：** 当同时存在多级费用设置时，优先级为：doctor > department > global
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: target_type
 *         in: query
 *         schema:
 *           type: string
 *           enum: [global, department, doctor]
 *         description: 按费用目标类型筛选
 *       - name: target_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: 按目标ID筛选（科室ID或医生ID）
 *       - name: service_type
 *         in: query
 *         schema:
 *           type: string
 *         description: 按服务类型筛选（如"普通挂号费"）
 *     responses:
 *       200:
 *         description: 成功获取费用列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               data: [
 *                 {
 *                   id: 1,
 *                   target_type: "global",
 *                   target_id: null,
 *                   service_type: "普通挂号费",
 *                   amount: 20.00,
 *                   created_at: "2024-01-15T10:30:00Z",
 *                   updated_at: "2024-01-15T10:30:00Z"
 *                 },
 *                 {
 *                   id: 2,
 *                   target_type: "department",
 *                   target_id: 1,
 *                   service_type: "专家挂号费",
 *                   amount: 50.00,
 *                   created_at: "2024-01-15T10:30:00Z",
 *                   updated_at: "2024-01-15T10:30:00Z"
 *                 }
 *               ]
 *               pagination:
 *                 page: 1
 *                 limit: 20
 *                 total: 2
 *                 totalPages: 1
 *                 hasNext: false
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/fees', adminController.listFees);

/**
 * @swagger
 * /api/admin/fees:
 *   post:
 *     tags: [管理员]
 *     summary: 设置挂号费用
 *     description: |
 *       管理员设置或更新挂号费用
 *       
 *       **费用层级说明：**
 *       - 全局费用：target_type="global", target_id=null
 *       - 科室费用：target_type="department", target_id=科室ID
 *       - 医生费用：target_type="doctor", target_id=医生ID
 *       
 *       **注意：** 医生费用会覆盖科室费用，科室费用会覆盖全局费用
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [target_type, service_type, amount]
 *             properties:
 *               target_type:
 *                 type: string
 *                 enum: [global, department, doctor]
 *                 example: "department"
 *                 description: "费用目标类型"
 *               target_id:
 *                 type: integer
 *                 nullable: true
 *                 description: |
 *                   目标ID（当target_type不为global时必填）
 *                   - department类型：填科室ID
 *                   - doctor类型：填医生ID
 *                 example: 1
 *               service_type:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: "专家挂号费"
 *                 description: "服务类型名称"
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0
 *                 maximum: 999999.99
 *                 multipleOf: 0.01
 *                 example: 50.00
 *                 description: "金额（最多两位小数）"
 *     responses:
 *       200:
 *         description: 费用设置成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "费用设置成功"
 *               data:
 *                 id: 2
 *                 target_type: "department"
 *                 target_id: 1
 *                 service_type: "专家挂号费"
 *                 amount: 50.00
 *                 created_at: "2024-01-15T10:30:00Z"
 *                 updated_at: "2024-01-15T10:30:00Z"
 *       400:
 *         description: 参数验证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "参数验证失败"
 *               code: 400
 *               details:
 *                 - field: "target_id"
 *                   message: "当target_type为department或doctor时，target_id不能为空"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: 费用记录已存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "该费用设置已存在"
 *               code: 409
 *               details:
 *                 - field: "service_type"
 *                   message: "相同target_type和target_id的服务类型已存在"
 */
router.post('/fees', adminController.setFee);

/**
 * @swagger
 * /api/admin/doctor-reviews/pending:
 *   get:
 *     tags: [管理员]
 *     summary: 获取待审核的医生资料
 *     description: 管理员获取待审核的医生资料列表
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *     responses:
 *       200:
 *         description: 成功获取待审核列表
 */
router.get('/doctor-reviews/pending', adminController.listPendingDoctorReviews);

/**
 * @swagger
 * /api/admin/doctor-reviews/{doctorId}/approve:
 *   post:
 *     tags: [管理员]
 *     summary: 审核通过医生资料
 *     description: 管理员审核通过医生资料
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: doctorId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 医生ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *                 description: "审核意见"
 *     responses:
 *       200:
 *         description: 审核通过
 *       404:
 *         description: 医生不存在
 */
router.post('/doctor-reviews/:doctorId/approve', adminController.approveDoctorProfile);

/**
 * @swagger
 * /api/admin/doctor-reviews/{doctorId}/reject:
 *   post:
 *     tags: [管理员]
 *     summary: 审核驳回医生资料
 *     description: 管理员审核驳回医生资料
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: doctorId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 医生ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "资料不完整"
 *     responses:
 *       200:
 *         description: 审核驳回成功
 */
router.post('/doctor-reviews/:doctorId/reject', adminController.rejectDoctorProfile);

/**
 * @swagger
 * /api/admin/leave-requests:
 *   get:
 *     tags: [管理员]
 *     summary: 获取请假申请列表
 *     description: 管理员获取医生的请假申请
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: 按状态筛选
 *       - name: doctor_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: 按医生筛选
 *     responses:
 *       200:
 *         description: 成功获取请假列表
 */
router.get('/leave-requests', adminController.listLeaveRequests);

/**
 * @swagger
 * /api/admin/leave-requests/{id}/approve:
 *   post:
 *     tags: [管理员]
 *     summary: 批准请假申请
 *     description: 管理员批准医生的请假申请
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 请假申请ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *                 description: "审批备注"
 *     responses:
 *       200:
 *         description: 请假批准成功
 */
router.post('/leave-requests/:id/approve', adminController.approveLeaveRequest);

/**
 * @swagger
 * /api/admin/leave-requests/{id}/reject:
 *   post:
 *     tags: [管理员]
 *     summary: 拒绝请假申请
 *     description: 管理员拒绝医生的请假申请
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: 请假申请ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "理由不充分"
 *     responses:
 *       200:
 *         description: 请假拒绝成功
 */
router.post('/leave-requests/:id/reject', adminController.rejectLeaveRequest);

/**
 * @swagger
 * /api/admin/tables:
 *   get:
 *     tags: [管理员]
 *     summary: 查看所有数据表
 *     description: 管理员查看数据库所有表的结构信息（调试用）
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功获取表信息
 */
router.get('/tables', adminController.listAllTables);

/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     tags: [管理员]
 *     summary: 获取所有预约订单
 *     description: 管理员获取所有挂号预约订单
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/dateParam'
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, waiting, cancelled, completed]
 *         description: 按状态筛选
 *       - name: doctor_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: 按医生筛选
 *       - name: account_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: 按患者筛选
 *     responses:
 *       200:
 *         description: 成功获取订单列表
 */
router.get('/orders', adminController.listOrders);

module.exports = router;