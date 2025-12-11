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

    // 查找 availability（仅锁定，绝不在预约/挂号流程中创建新号源）
    // Lock all availabilities for this doctor & date (day-level pool)
    const [availRows] = await conn.query(
      'SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? FOR UPDATE',
      [doctor_id, normDate]
    );

    // find availability matching slot if exists; if none, keep null to avoid implying capacity
    let availability = null;
    let is_waitlist = false;
    if (Array.isArray(availRows) && availRows.length > 0) {
      availability = availRows.find(r => r.slot === slot) || null;
    }

    // treat capacity/booked as day-level: use first row's capacity/booked as representative (0 if no rows)
    const dayCapacity = (availRows[0] && availRows[0].capacity) ? parseInt(availRows[0].capacity, 10) : 0;
    const dayBooked = (availRows[0] && availRows[0].booked) ? parseInt(availRows[0].booked, 10) : 0;

    // If caller explicitly requests a forced waitlist (create an appointment rather than immediate registration),
    // insert a waiting order without modifying booked counters.
    if (payload && payload.force_waitlist) {
      const [r] = await conn.query(
        'INSERT INTO orders (account_id, department_id, doctor_id, availability_id, date, slot, status, is_waitlist, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [account_id, department_id, doctor_id, availability ? availability.id : null, normDate, slot, 'waiting', true, note || null]
      );
      const [orderRows] = await conn.query('SELECT * FROM orders WHERE id = ?', [r.insertId]);
      await conn.commit();
      try { await mqPublisher.publishOrderEvent('waiting', orderRows[0]); } catch (e) { console.warn('MQ publish failed', e.message); }
      return orderRows[0];
    }

    if (dayBooked < dayCapacity) {
      // confirm: increment booked for all avail rows for that doctor/date
      const newBooked = dayBooked + 1;
      await conn.query('UPDATE doctor_availability SET booked = ? WHERE doctor_id = ? AND date = ?', [newBooked, doctor_id, normDate]);

      const [r] = await conn.query(
        'INSERT INTO orders (account_id, department_id, doctor_id, availability_id, date, slot, status, is_waitlist, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [account_id, department_id, doctor_id, (availability ? availability.id : null), normDate, slot, 'confirmed', false, note || null]
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

    // 修复：使用正确的解构方式
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!rows || rows.length === 0) {
      await conn.rollback();
      conn.release();
      throw new Error('order not found');
    }
    
    const order = rows[0];

    if (order.status === 'cancelled') {
      await conn.commit();
      conn.release();
      return order;
    }

    // 更新订单状态
    await conn.query(
      'UPDATE orders SET status = ?, is_waitlist = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      ['cancelled', orderId]
    );

    // 发布取消事件（放在这里确保一定会发布）
    try { 
      await mqPublisher.publishOrderEvent('cancelled', { 
        orderId, 
        cancelledBy,
        oldStatus: order.status 
      }); 
    } catch (e) { 
      console.warn('MQ publish cancelled event failed', e.message); 
    }

    // 若之前是 confirmed，需要减少 day-level booked 并 promote day-level waiting queue
    if (order.status === 'confirmed') {
      // lock all availabilities for this doctor/date
      const [availRows] = await conn.query(
        'SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? FOR UPDATE', 
        [order.doctor_id, order.date]
      );
      
      // 修复：检查 availRows 是否存在且有数据
      if (availRows && availRows.length > 0) {
        const rep = availRows[0];
        if (rep.booked > 0) {
          const newBooked = rep.booked - 1;
          await conn.query(
            'UPDATE doctor_availability SET booked = ? WHERE doctor_id = ? AND date = ?', 
            [newBooked, order.doctor_id, order.date]
          );

          // 尝试提升候补队列：查找同医生同日期最早的 waiting order（不限 slot/availability）
          const [waitRows] = await conn.query(
            "SELECT * FROM orders WHERE doctor_id = ? AND date = ? AND is_waitlist = 1 AND status = 'waiting' ORDER BY created_at ASC LIMIT 1 FOR UPDATE",
            [order.doctor_id, order.date]
          );
          
          // 修复：检查 waitRows 是否存在且有数据
          if (waitRows && waitRows.length > 0) {
            const next = waitRows[0];
            // 将其设为 confirmed，并把 is_waitlist 取消，同时 booked++（恢复为原值）
            await conn.query(
              'UPDATE orders SET status = ?, is_waitlist = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
              ['confirmed', next.id]
            );
            
            const restoredBooked = newBooked + 1;
            await conn.query(
              'UPDATE doctor_availability SET booked = ? WHERE doctor_id = ? AND date = ?', 
              [restoredBooked, order.doctor_id, order.date]
            );
            
            // 获取已提升的订单详情并发布 promoted 事件
            const [promotedRows] = await conn.query('SELECT * FROM orders WHERE id = ?', [next.id]);
            if (promotedRows && promotedRows.length > 0) {
              const promotedOrder = promotedRows[0];
              try { 
                await mqPublisher.publishOrderEvent('promoted', promotedOrder); 
              } catch (e) { 
                console.warn('MQ publish promoted event failed', e.message); 
              }
            }
          }
        }
      }
    }

    await conn.commit();
    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { createRegistration, cancelRegistration };
