Page({
  data: {
    departments: [],
    filteredDepartments: [],
    selectedDept: 0,
    searchValue: ''
  },

  onLoad() {
    // fetch departments tree from backend
    const { request } = require('../../utils/request');
    request({ url: '/api/departments', method: 'GET' })
      .then(res => {
        if (res && res.success) {
          const list = res.data || [];
          this.setData({ departments: list, filteredDepartments: list });
        } else {
          this.setData({ departments: [], filteredDepartments: [] });
        }
      })
      .catch(err => {
        console.error('Failed to load departments', err);
        this.setData({ departments: [], filteredDepartments: [] });
      });
  },

  onSelectDept(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ selectedDept: index });
  },

  onSelectSub(e) {
    const sub = e.currentTarget.dataset.sub;
    const deptObj = this.data.filteredDepartments[this.data.selectedDept];
    const selected = { id: sub.id, name: sub.name, parent: { id: deptObj.id, name: deptObj.name } };
    wx.setStorageSync('selectedDepartment', selected);
    wx.showToast({ title: `已选择：${deptObj.name} - ${sub.name}`, icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },

  onSelectMain(e) {
    const dept = e.currentTarget.dataset.dept;
    if (!dept) return;
    const selected = { id: dept.id, name: dept.name };
    wx.setStorageSync('selectedDepartment', selected);
    wx.showToast({ title: `已选择：${dept.name}`, icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },

  onSearchInput(e) {
    const value = e.detail.value.trim();
    const list = this.data.departments || [];
    const filtered = list.map(d => {
      const matchedChildren = (d.children || []).filter(c => c.name.includes(value) || d.name.includes(value));
      return Object.assign({}, d, { children: matchedChildren.length ? matchedChildren : d.children });
    }).filter(d => d.name.includes(value) || (d.children && d.children.length));
    this.setData({ searchValue: value, filteredDepartments: filtered.length ? filtered : list, selectedDept: 0 });
  }
});
