// pages/docPick/docPick.js
Page({
  data: {
    doctors: [
      { name: '内科', subs: ['呼吸内科', '心血管内科', '消化内科', '内分泌科'] },
      { name: '外科', subs: ['普外科', '骨科', '神经外科', '心胸外科'] },
      { name: '儿科', subs: ['小儿内科', '小儿外科'] },
      { name: '妇产科', subs: ['妇科', '产科'] },
      { name: '五官科', subs: ['耳鼻喉科', '眼科', '口腔科'] }
    ],
    selectedDoc: 0,
  },

  onLoad() {
    this.setData({
      filteredDoctors: this.data.doctors
    });
  },

  onSelectDoc(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ selectedDoc: index });
  },

  onSelectSub(e) {
    const sub = e.currentTarget.dataset.sub;
    const doc = this.data.filteredDoctors[this.data.selectedDoc].name;
    wx.showToast({
      title: `${doc} - ${sub}`,
      icon: 'success'
    });
    // store a minimal doctor object so register page can read name/id
    wx.setStorageSync('selectedDoctor', { id: null, name: `${doc} - ${sub}` });
    setTimeout(() => wx.navigateBack(), 800);
  },

  onSearchInput(e) {
    const value = e.detail.value.trim();
    const filtered = this.data.doctors.filter(d =>
      d.name.includes(value) || d.subs.some(s => s.includes(value))
    );
    this.setData({
      searchValue: value,
      filteredDoctors: filtered.length ? filtered : this.data.doctors,
      selectedDoc: 0
    });
  }
});
