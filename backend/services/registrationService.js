const db = require('../db');
const mqPublisher = require('../mq/publisher');

/**
 * 尝试为用户创建挂号（订单）
 * - 找到对应的 doctor_availability
 * - 如果 capacity > booked 则直接确认并 booked++
 * - 否则将订单标记为 waiting (is_waitlist=true)
 * 全过程使用事务保证一致性
 *
 * input: { account_id, department_id, doctor_id, date, slot, note }
 * output: created order record
 */
async function createRegistration(payload) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { account_id, department_id, doctor_id, date, slot, note } = payload;
    // normalize date to YYYY-MM-DD to avoid inserting ISO timestamps into DATE columns
    function normalizeDate(d) {
      if (!d) return null;
      if (typeof d === 'string') {
        // already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        // ISO string like 2025-11-20T00:00:00.000Z
        if (d.indexOf('T') !== -1) return d.split('T')[0];
        // space separated
        if (d.indexOf(' ') !== -1) return d.split(' ')[0];
        // try Date parse
        const dt = new Date(d);
        if (!isNaN(dt.getTime())) {
          const y = dt.getFullYear();
          const m = String(dt.getMonth() + 1).padStart(2, '0');
          const day = String(dt.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        }
        return d;
      }
      if (d instanceof Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return d;
    }

    const normDate = normalizeDate(date);

    // 查找 availability
    // Lock all availabilities for this doctor & date (day-level pool)
    const [availRows] = await conn.query(
      'SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? FOR UPDATE',
      [doctor_id, normDate]
    );

    let availability = null;
    let is_waitlist = false;

    if (!availRows || availRows.length === 0) {
      // 若没有任何 availability 记录，创建一条代表该 slot 的记录，capacity=1
      const [ins] = await conn.query(
        'INSERT INTO doctor_availability (doctor_id, date, slot, capacity, booked) VALUES (?, ?, ?, 1, 0)',
        [doctor_id, normDate, slot]
      );
      const [newRows] = await conn.query('SELECT * FROM doctor_availability WHERE id = ?', [ins.insertId]);
      availability = newRows[0];
      // reload availRows
      const [reloaded] = await conn.query('SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? FOR UPDATE', [doctor_id, date]);
      // use reloaded as current day state
      // fall through
    }

    // refresh availRows (in case we inserted)
  const [currentAvailRows] = await conn.query('SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? FOR UPDATE', [doctor_id, normDate]);
    // find availability matching slot if exists
    availability = currentAvailRows.find(r => r.slot === slot) || currentAvailRows[0];

    // treat capacity/booked as day-level: use first row's capacity/booked as representative
    const dayCapacity = (currentAvailRows[0] && currentAvailRows[0].capacity) ? parseInt(currentAvailRows[0].capacity, 10) : 0;
    const dayBooked = (currentAvailRows[0] && currentAvailRows[0].booked) ? parseInt(currentAvailRows[0].booked, 10) : 0;

    if (dayBooked < dayCapacity) {
      // confirm: increment booked for all avail rows for that doctor/date
  const newBooked = dayBooked + 1;
  await conn.query('UPDATE doctor_availability SET booked = ? WHERE doctor_id = ? AND date = ?', [newBooked, doctor_id, normDate]);

      const [r] = await conn.query(
        'INSERT INTO orders (account_id, department_id, doctor_id, availability_id, date, slot, status, is_waitlist, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [account_id, department_id, doctor_id, availability.id, normDate, slot, 'confirmed', false, note || null]
      );

      const [orderRows] = await conn.query('SELECT * FROM orders WHERE id = ?', [r.insertId]);
      await conn.commit();
      // 发布 MQ 事件：order.created (confirmed)
      try { await mqPublisher.publishOrderEvent('created', orderRows[0]); } catch (e) { console.warn('MQ publish failed', e.message); }
      return orderRows[0];
    } else {
      // 已满，加入候补（候补不改变 booked）
      is_waitlist = true;
      const [r] = await conn.query(
        'INSERT INTO orders (account_id, department_id, doctor_id, availability_id, date, slot, status, is_waitlist, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [account_id, department_id, doctor_id, availability ? availability.id : null, normDate, slot, 'waiting', true, note || null]
      );
      const [orderRows] = await conn.query('SELECT * FROM orders WHERE id = ?', [r.insertId]);
      await conn.commit();
      // 发布 MQ 事件：order.waiting
      try { await mqPublisher.publishOrderEvent('waiting', orderRows[0]); } catch (e) { console.warn('MQ publish failed', e.message); }
      return orderRows[0];
    }
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 取消订单（订单可由用户或管理员取消）
 * 如果订单为 confirmed，需要把 availability.booked--，并尝试提升候补队列中的第一位
 */
async function cancelRegistration(orderId, cancelledBy) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const order = rows[0];
    if (!order) throw new Error('order not found');

    if (order.status === 'cancelled') {
      await conn.commit();
      return order;
    }

    // 更新订单状态
    await conn.query('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['cancelled', orderId]);

    // 若之前是 confirmed，需要减少 day-level booked 并 promote day-level waiting queue
    if (order.status === 'confirmed') {
      // lock all availabilities for this doctor/date
  const [availRows] = await conn.query('SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? FOR UPDATE', [order.doctor_id, order.date]);
      const rep = availRows && availRows[0];
      if (rep && rep.booked > 0) {
        const newBooked = rep.booked - 1;
        await conn.query('UPDATE doctor_availability SET booked = ? WHERE doctor_id = ? AND date = ?', [newBooked, order.doctor_id, order.date]);

        // 尝试提升候补队列：查找同医生同日期最早的 waiting order（不限 slot/availability）
        const [waitRows] = await conn.query(
          "SELECT * FROM orders WHERE doctor_id = ? AND date = ? AND is_waitlist = 1 AND status = 'waiting' ORDER BY created_at ASC LIMIT 1 FOR UPDATE",
          [order.doctor_id, order.date]
        );
        const next = waitRows[0];
        if (next) {
          // 将其设为 confirmed，并把 is_waitlist 取消，同时 booked++（恢复为原值）
          await conn.query('UPDATE orders SET status = ?, is_waitlist = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['confirmed', next.id]);
          const restoredBooked = newBooked + 1;
          await conn.query('UPDATE doctor_availability SET booked = ? WHERE doctor_id = ? AND date = ?', [restoredBooked, order.doctor_id, order.date]);
          // 获取已提升的订单详情并发布 promoted 事件
          const [promotedRows] = await conn.query('SELECT * FROM orders WHERE id = ?', [next.id]);
          const promotedOrder = promotedRows[0];
          try { await mqPublisher.publishOrderEvent('promoted', promotedOrder); } catch (e) { console.warn('MQ publish failed', e.message); }
        }
      }
    }

  await conn.commit();
  // 发布取消事件
  try { await mqPublisher.publishOrderEvent('cancelled', { orderId, cancelledBy }); } catch (e) { console.warn('MQ publish failed', e.message); }

  return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { createRegistration, cancelRegistration };
