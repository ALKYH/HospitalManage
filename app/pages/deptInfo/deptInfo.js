// pages/deptInfo/deptInfo.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    department: {},
    doctors: [],
    doctorNames: [],
    departments: [],
    departmentNames: [],
    selectedDoctorIndex: -1,
    selectedDoctor: null,
    doctorLoading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const selected = wx.getStorageSync('selectedDepartment') || null;
    // preload departments for inline picker
    this.loadDepartments();
    if (selected) {
      this.setData({ department: selected });
      this.loadDoctors(selected.id);
    } else if (options && options.id) {
      // try to fetch department list and find by id (public/admin endpoints expose list)
      const { request } = require('../../utils/request');
      request({ url: `/api/admin/departments`, method: 'GET' }).then(res => {
        if (res && res.success) {
          const list = res.data || [];
          const found = list.find(d => String(d.id) === String(options.id));
          if (found) {
            this.setData({ department: found });
            this.loadDoctors(found.id);
          }
        }
      }).catch(() => {});
    }
  },

  loadDepartments() {
    const { request } = require('../../utils/request');
    request({ url: '/api/public/departments', method: 'GET' }).then(res => {
      if (res && res.success) {
        const list = res.data || [];
        const flat = [];
        list.forEach(p => {
          flat.push({ id: p.id, name: p.name, parent: null, description: p.description || p.desc || '' });
          (p.children || []).forEach(c => flat.push({ id: c.id, name: c.name, parent: { id: p.id, name: p.name }, description: c.description || c.desc || '' }));
        });
        const names = flat.map(d => d.name || `${d.id}`);
        this.setData({ departments: flat, departmentNames: names });
      }
    }).catch(() => {});
  },

  onDeptPickerChange(e) {
    const idx = parseInt(e.detail.value, 10);
    if (isNaN(idx) || idx < 0) return;
    const depts = this.data.departments || [];
    const dept = depts[idx];
    if (!dept) return;
    // show department info immediately
    this.setData({ department: dept });
    // try to fetch richer intro from data files
    const { request } = require('../../utils/request');
    request({ url: `/api/public/department-intro/${dept.id}`, method: 'GET' }).then(intro => {
      if (intro && intro.success) {
        const merged = Object.assign({}, dept, intro.data || {});
        this.setData({ department: merged });
      }
    }).catch(() => {});
    // load doctors for this dept
    this.loadDoctors(dept.id);
  },

  onShow() {
    // handle selection returned from deptPick or docPick
    const selDept = wx.getStorageSync('selectedDepartment');
    if (selDept) {
      if (typeof selDept === 'object' && selDept.id) {
        this.setData({ department: selDept });
        this.loadDoctors(selDept.id);
      }
      wx.removeStorageSync('selectedDepartment');
    }

    const selDoc = wx.getStorageSync('selectedDoctor');
    if (selDoc) {
      // selDoc may be {id, name} or minimal string-like object
      if (selDoc && selDoc.id) {
        this.setData({ selectedDoctorIndex: -1 });
        this.loadDoctorDetails(selDoc.id);
      } else if (selDoc && selDoc.name) {
        // set a lightweight selectedDoctor with name only
        this.setData({ selectedDoctor: { name: selDoc.name, id: selDoc.id || null } });
      }
      wx.removeStorageSync('selectedDoctor');
    }
  },

  loadDoctors(deptId) {
    if (!deptId) return;
    const { request } = require('../../utils/request');
    request({ url: `/api/doctor?department_id=${deptId}`, method: 'GET' }).then(res => {
      if (res && res.success) {
        const docs = res.data || [];
        const names = docs.map(d => d.name || `${d.id}`);
        this.setData({ doctors: docs, doctorNames: names, selectedDoctorIndex: -1 });
        // reset selected doctor
        this.setData({ selectedDoctor: null });
      }
    }).catch(() => {});
  },

  onDoctorPickerChange(e) {
    const idx = parseInt(e.detail.value, 10);
    if (isNaN(idx) || idx < 0) return;
    const docs = this.data.doctors || [];
    const doc = docs[idx];
    if (!doc) return;
    // show doctor details inline
    this.setData({ selectedDoctorIndex: idx });
    this.loadDoctorDetails(doc.id);
  },

  onDocTap(e) {
    const id = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id;
    if (!id) return;
    // show doctor details inline
    const idx = (this.data.doctors || []).findIndex(d => String(d.id) === String(id));
    if (idx >= 0) this.setData({ selectedDoctorIndex: idx });
    this.loadDoctorDetails(id);
  },

  goToDepartment() {
    wx.navigateTo({ url: '/pages/deptPick/deptPick' });
  },


  loadDoctorDetails(id) {
    if (!id) return;
    const { request } = require('../../utils/request');
    this.setData({ doctorLoading: true });
    // prefer static intro from data files
    request({ url: `/api/public/doctor-intro/${id}`, method: 'GET' }).then(intro => {
      if (intro && intro.success) {
        // try to supplement with DB fields if available
        request({ url: `/api/doctor/${id}`, method: 'GET' }).then(res => {
          const db = (res && res.success) ? res.data : {};
          const merged = Object.assign({}, db || {}, intro.data || {});
          this.setData({ selectedDoctor: merged });
        }).catch(() => {
          this.setData({ selectedDoctor: intro.data });
        }).finally(() => {
          this.setData({ doctorLoading: false });
        });
      } else {
        // fallback to DB
        request({ url: `/api/doctor/${id}`, method: 'GET' }).then(res => {
          if (res && res.success) this.setData({ selectedDoctor: res.data });
        }).catch(() => {}).finally(() => {
          this.setData({ doctorLoading: false });
        });
      }
    }).catch(() => {
      // fallback to DB
      request({ url: `/api/doctor/${id}`, method: 'GET' }).then(res => {
        if (res && res.success) this.setData({ selectedDoctor: res.data });
      }).catch(() => {}).finally(() => {
        this.setData({ doctorLoading: false });
      });
    });
  },

  /** 生命周期函数--监听页面初次渲染完成 */
  onReady() {},

  /** 生命周期函数--监听页面显示 */
  onShow() {},

  /** 生命周期函数--监听页面隐藏 */
  onHide() {},

  /** 生命周期函数--监听页面卸载 */
  onUnload() {},

  onBack() {
    wx.navigateBack();
  },

  goToDoctor() {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  }


})