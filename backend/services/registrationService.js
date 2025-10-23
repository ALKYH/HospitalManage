const db = require('../db');

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

    // 查找 availability
    const [availRows] = await conn.query(
      'SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? AND slot = ? FOR UPDATE',
      [doctor_id, date, slot]
    );

    let availability = availRows[0];
    let is_waitlist = false;

    if (!availability) {
      // 若没有 availability 记录，创建一条默认 capacity=1
      const [ins] = await conn.query(
        'INSERT INTO doctor_availability (doctor_id, date, slot, capacity, booked) VALUES (?, ?, ?, 1, 0)',
        [doctor_id, date, slot]
      );
      const [newRows] = await conn.query('SELECT * FROM doctor_availability WHERE id = ?', [ins.insertId]);
      availability = newRows[0];
    }

    if (availability.booked < availability.capacity) {
      // 可以直接确认
      const newBooked = availability.booked + 1;
      await conn.query('UPDATE doctor_availability SET booked = ? WHERE id = ?', [newBooked, availability.id]);

      const [r] = await conn.query(
        'INSERT INTO orders (account_id, department_id, doctor_id, availability_id, date, slot, status, is_waitlist, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [account_id, department_id, doctor_id, availability.id, date, slot, 'confirmed', false, note || null]
      );

      const [orderRows] = await conn.query('SELECT * FROM orders WHERE id = ?', [r.insertId]);
      await conn.commit();
      return orderRows[0];
    } else {
      // 已满，加入候补
      is_waitlist = true;
      const [r] = await conn.query(
        'INSERT INTO orders (account_id, department_id, doctor_id, availability_id, date, slot, status, is_waitlist, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [account_id, department_id, doctor_id, availability ? availability.id : null, date, slot, 'waiting', true, note || null]
      );
      const [orderRows] = await conn.query('SELECT * FROM orders WHERE id = ?', [r.insertId]);
      await conn.commit();
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

    // 若之前是 confirmed，需要减少 booked 并 promote
    if (order.status === 'confirmed' && order.availability_id) {
      const [availRows] = await conn.query('SELECT * FROM doctor_availability WHERE id = ? FOR UPDATE', [order.availability_id]);
      const avail = availRows[0];
      if (avail && avail.booked > 0) {
        await conn.query('UPDATE doctor_availability SET booked = ? WHERE id = ?', [avail.booked - 1, avail.id]);

        // 尝试提升候补队列：查找最早创建的 waiting order 同一 availability
        const [waitRows] = await conn.query(
          "SELECT * FROM orders WHERE availability_id = ? AND is_waitlist = 1 AND status = 'waiting' ORDER BY created_at ASC LIMIT 1 FOR UPDATE",
          [avail.id]
        );
        const next = waitRows[0];
        if (next) {
          // 将其设为 confirmed，并 booked++
          await conn.query('UPDATE orders SET status = ?, is_waitlist = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['confirmed', next.id]);
          await conn.query('UPDATE doctor_availability SET booked = ? WHERE id = ?', [avail.booked, avail.id]);
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
