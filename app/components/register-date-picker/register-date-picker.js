Component({
    properties: {
      availability: { type: Array, value: [] },
      // regiType: e.g. '普通', '专家', '特需' or '默认' - used to filter available slots by service type
      regiType: { type: String, value: '' }
    },
    data: {
      today: '',
      selectedDate: '',
      selectedTime: '',
      selectedTimeIndex: 0,
      selectedDateIndex: 0,
      dates: [], // 存储所有有号源的日期 (YYYY-MM-DD)
      calendarDates: [], // 新增：用于日历视图的数据结构
      timeSlots: []
    },
    lifetimes: {
      attached() {
        const today = this.formatDate(new Date());
        this.setData({ today });
      }
    },
    observers: {
      'availability, regiType': function(avail, regiType) {
        if (!Array.isArray(avail)) avail = [];
        let key = '';
        if (regiType && typeof regiType === 'string') key = regiType.replace(/号$/, '').trim();
  
        const map = {};
        avail.forEach(a => {
          if (!a || !a.date) return;
          const abt = a.available_by_type || {};
          const hasForKey = (key && (typeof abt[key] !== 'undefined'));
          const hasDefault = (typeof abt['默认'] !== 'undefined');
          const availableCount = hasForKey ? parseInt(abt[key] || 0, 10) : (hasDefault ? parseInt(abt['默认'] || 0, 10) : Math.max(0, (a.capacity || 0) - (a.booked || 0)));
          if (availableCount > 0) {
            map[a.date] = map[a.date] || new Set();
            map[a.date].add(a.slot);
          }
        });
  
        const availableDates = Object.keys(map).sort();
        this._dateSlotsMap = {};
        availableDates.forEach(d => { this._dateSlotsMap[d] = Array.from(map[d]); });
            
        // === 核心改动：生成日历视图数据结构 ===
        const calendarData = this.getCalendarData(availableDates);
        // ====================================
  
        this.setData({ dates: availableDates, calendarDates: calendarData });
        
        if (availableDates.length > 0) {
          // 自动选中第一个有号源的日期
          const firstAvailableDate = availableDates[0];
          const prev = this.data.selectedDate;
          // 保持之前选择，如果依然有号源
          const sel = prev && availableDates.includes(prev) ? prev : firstAvailableDate;
          const idx = availableDates.indexOf(sel);
          
          // 触发一次日期选择更新 timeSlots
          this.updateDateSelection(sel, idx);
  
        } else {
          this.setData({ selectedDate: '', timeSlots: [], selectedDateIndex: 0, selectedTimeIndex: 0, selectedTime: '' });
        }
      }
    },
    methods: {
      formatDate(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
      },
  
      // 新增方法：生成日历视图数据
      getCalendarData(availableDates) {
        const today = new Date();
        const calendar = [];
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        
        // 生成未来 14 天的日期（周日历视图通常只显示短时间范围）
        for (let i = 0; i < 14; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          const dateString = this.formatDate(date);
  
          // 判断是否为今天
          const isToday = i === 0;
  
          // 判断是否有号源
          const hasAvailability = availableDates.includes(dateString);
  
          calendar.push({
            fullDate: dateString,
            day: date.getDate(),
            dayName: isToday ? '今天' : dayNames[date.getDay()],
            hasAvailability: hasAvailability
          });
        }
        return calendar;
      },
  
      // 封装日期选择后的更新逻辑
      updateDateSelection(date, idx) {
        this.setData({ selectedDate: date, selectedDateIndex: idx });
        const slots = this._dateSlotsMap && this._dateSlotsMap[date] ? this._dateSlotsMap[date] : [];
            
        // 保持 TimePicker 选中逻辑：如果当前选中的 timeSlots 不为空，则选中第一个，否则清空。
        const translatedSlots = this._translateSlots(slots);
        const selectedTime = translatedSlots.length > 0 ? translatedSlots[0] : '';
  
        this.setData({ 
          timeSlots: translatedSlots, 
          selectedTimeIndex: 0, 
          selectedTime: selectedTime
        });
  
        this.triggerUpdate(); // 触发事件告知父组件
      },
  
      // 新增方法：日历卡片点击事件（替换 onDateChange）
      onCalendarTap(e) {
        const { date } = e.currentTarget.dataset;
        const dates = this.data.dates || [];
        const idx = dates.indexOf(date);
        
        // 只有有号源的日期才允许选择
        if (idx === -1) {
          wx.showToast({ title: '当日无排班或已满', icon: 'none' });
          return;
        }
  
        // 检查是否重复点击
        if (date === this.data.selectedDate) return;
  
        this.updateDateSelection(date, idx);
      },
  
      // 原 onDateChange 方法被 onCalendarTap 替换，但保留了 onTimeChange
      onTimeChange(e) {
        const index = e.detail.value;
        this.setData({ selectedTimeIndex: index, selectedTime: this.data.timeSlots[index] });
        this.triggerUpdate();
      },
      
      triggerUpdate() {
        const { selectedDate, selectedTime } = this.data;
        if (selectedDate && selectedTime) {
          this.triggerEvent('timeSelected', {
            date: selectedDate,
            time: selectedTime
          });
        }
      },
      _translateSlots(slots) {
        const map = {
          '8-10': '上午 08:00-10:00',
          '10-12': '上午 10:00-12:00',
          '14-16': '下午 14:00-16:00',
          '16-18': '下午 16:00-18:00'
        };
        return (slots || []).map(s => map[s] || s);
      }
    }
  });