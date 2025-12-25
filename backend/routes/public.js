const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

/**
 * @swagger
 * /api/public/departments:
 *   get:
 *     tags: [公共]
 *     summary: 获取科室树形结构
 *     description: 获取所有科室的树形结构信息，包含父子关系
 *     parameters:
 *       - name: include_doctors
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: "是否包含医生信息"
 *       - name: only_available
 *         in: query
 *         schema:
 *           type: boolean
 *           default: true
 *         description: "是否只显示有可用医生的科室"
 *     responses:
 *       200:
 *         description: 成功获取科室树
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               data: [
 *                 {
 *                   id: 1,
 *                   name: "内科",
 *                   code: "NEIKE",
 *                   parent_id: null,
 *                   children: [
 *                     {
 *                       id: 2,
 *                       name: "呼吸内科",
 *                       code: "HUXI",
 *                       parent_id: 1,
 *                       children: [],
 *                       doctor_count: 5,
 *                       available_doctors: 3
 *                     },
 *                     {
 *                       id: 3,
 *                       name: "消化内科",
 *                       code: "XIAOHUA",
 *                       parent_id: 1,
 *                       children: [],
 *                       doctor_count: 8,
 *                       available_doctors: 6
 *                     }
 *                   ],
 *                   doctor_count: 13,
 *                   available_doctors: 9
 *                 },
 *                 {
 *                   id: 4,
 *                   name: "外科",
 *                   code: "WAIKE",
 *                   parent_id: null,
 *                   children: [
 *                     {
 *                       id: 5,
 *                       name: "普外科",
 *                       code: "PUWAI",
 *                       parent_id: 4,
 *                       children: [],
 *                       doctor_count: 10,
 *                       available_doctors: 8
 *                     }
 *                   ],
 *                   doctor_count: 10,
 *                   available_doctors: 8
 *                 }
 *               ]
 *       500:
 *         description: 服务器内部错误
 */
router.get('/departments', publicController.listDepartmentsTree);

// department/doctor intro from static data files
router.get('/department-intro/:id', publicController.getDepartmentIntro);
router.get('/doctor-intro/:id', publicController.getDoctorIntro);

module.exports = router;