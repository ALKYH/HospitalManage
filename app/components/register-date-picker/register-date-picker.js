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
    dates: [],
    timeSlots: []
  },
  lifetimes: {
    attached() {
      const today = this.formatDate(new Date());
      this.setData({ today });
    }
  },
  observers: {
    // observe both availability and regiType so the slots are filtered correctly
    'availability, regiType': function(avail, regiType) {
      if (!Array.isArray(avail)) avail = [];
      // normalize regiType: strip suffix '号' if present
      let key = '';
      if (regiType && typeof regiType === 'string') key = regiType.replace(/号$/, '').trim();

      // build map of date -> slots where the slot has available capacity for the selected regi type
      const map = {};
      avail.forEach(a => {
        if (!a || !a.date) return;
        // a.available_by_type should be provided by backend (doctorService.getAvailabilityByDoctor)
        const abt = a.available_by_type || {};
        // If a specific type key exists, use it; otherwise fall back to '默认' availability
        const hasForKey = (key && (typeof abt[key] !== 'undefined'));
        const hasDefault = (typeof abt['默认'] !== 'undefined');
        const availableCount = hasForKey ? parseInt(abt[key] || 0, 10) : (hasDefault ? parseInt(abt['默认'] || 0, 10) : Math.max(0, (a.capacity || 0) - (a.booked || 0)));
        if (availableCount > 0) {
          map[a.date] = map[a.date] || new Set();
          map[a.date].add(a.slot);
        }
      });

      const dates = Object.keys(map).sort();
      this._dateSlotsMap = {};
      dates.forEach(d => { this._dateSlotsMap[d] = Array.from(map[d]); });
      this.setData({ dates: dates });
      if (dates.length>0) {
        // keep previously selected date if still available
        const prev = this.data.selectedDate;
        const sel = prev && dates.includes(prev) ? prev : dates[0];
        const idx = dates.indexOf(sel);
        this.setData({ selectedDate: sel, selectedDateIndex: idx });
        this.setData({ timeSlots: this._translateSlots(this._dateSlotsMap[sel] || []) });
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
    onDateChange(e) {
      const idx = e.detail.value;
      const dates = this.data.dates || [];
      const date = dates[idx] || '';
      this.setData({ selectedDate: date, selectedDateIndex: idx });
      // update available timeSlots for this date
      const slots = this._dateSlotsMap && this._dateSlotsMap[date] ? this._dateSlotsMap[date] : [];
      this.setData({ timeSlots: this._translateSlots(slots), selectedTimeIndex: 0, selectedTime: '' });
      this.triggerUpdate();
    },
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
