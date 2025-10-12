Page({
  data: {
    departments: [
      { name: '内科', subs: ['呼吸内科', '心血管内科', '消化内科', '内分泌科'] },
      { name: '外科', subs: ['普外科', '骨科', '神经外科', '心胸外科'] },
      { name: '儿科', subs: ['小儿内科', '小儿外科'] },
      { name: '妇产科', subs: ['妇科', '产科'] },
      { name: '五官科', subs: ['耳鼻喉科', '眼科', '口腔科'] }
    ],
    filteredDepartments: [],
    selectedDept: 0,
    searchValue: ''
  },

  onLoad() {
    this.setData({
      filteredDepartments: this.data.departments
    });
  },

  onSelectDept(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ selectedDept: index });
  },

  onSelectSub(e) {
    const sub = e.currentTarget.dataset.sub;
    const dept = this.data.filteredDepartments[this.data.selectedDept].name;
    wx.showToast({
      title: `${dept} - ${sub}`,
      icon: 'success'
    });
    wx.setStorageSync('selectedDepartment', `${dept} - ${sub}`);
    setTimeout(() => wx.navigateBack(), 800);
  },

  onSearchInput(e) {
    const value = e.detail.value.trim();
    const filtered = this.data.departments.filter(d =>
      d.name.includes(value) || d.subs.some(s => s.includes(value))
    );
    this.setData({
      searchValue: value,
      filteredDepartments: filtered.length ? filtered : this.data.departments,
      selectedDept: 0
    });
  }
});
