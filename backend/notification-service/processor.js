const smtp = require('./providers/smtp');
const redis = require('./providers/redis');
const mq = require('./mqClient');
const db = require('./dbClient');

// 简单的事件 -> 通知映射器与发送器
async function processEvent(routingKey, payload) {
  // routingKey 例如 appointment.created
  const eventType = routingKey || (payload && payload.type) || 'unknown';

  // 选择模板与渠道（示例逻辑，后续应读取模板表并尊重用户偏好）
  let template = null;
  let channel = 'email';

  if (eventType.startsWith('appointment.')) {
    template = 'appointment_confirmation';
    channel = 'email';
  } else if (eventType.startsWith('waitlist.')) {
    template = 'waitlist_promotion';
    channel = 'sms';
  } else if (eventType.startsWith('visit.')) {
    template = 'visit_notification';
    channel = 'inapp';
  }

  const recipient = extractRecipient(payload);
  if (!recipient) {
    console.warn('No recipient found for event', eventType);
    return;
  }

  const notification = {
    event_id: payload && payload.appointmentId || payload.id || null,
    event_type: eventType,
    recipient_id: recipient.id || null,
    recipient_addr: recipient.email || recipient.phone || null,
    channel,
    template,
    status: 'pending',
    attempts: 0,
    created_at: new Date()
  };

  // dedup: 使用 event_id 或 eventType+recipient 作为去重 key
  const eventId = (payload && (payload.eventId || payload.event_id || payload.appointmentId || payload.id)) || null;
  const dedupKey = eventId ? `notif:dedup:${eventId}` : `notif:dedup:${eventType}:${notification.recipient_id || notification.recipient_addr}`;

  try {
    const acquired = await redis.setIfNotExists(dedupKey, parseInt(process.env.NOTIF_DEDUP_TTL_SEC || '300'));
    if (!acquired) {
      console.log('Duplicate notification suppressed for', dedupKey);
      return;
    }
  } catch (err) {
    console.warn('Redis dedup check failed, proceeding:', err.message);
  }

  // persist notification record (best-effort)
  try {
    const [res] = await db.query(
      'INSERT INTO notifications (event_id,event_type,recipient_id,recipient_addr,channel,template,status,attempts,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [notification.event_id, notification.event_type, notification.recipient_id, notification.recipient_addr, notification.channel, notification.template, notification.status, notification.attempts, notification.created_at]
    );
    notification.id = res.insertId;
  } catch (err) {
    console.warn('Failed to persist notification record:', err.message);
  }

  // send with retry logic
  const MAX_RETRIES = parseInt(process.env.NOTIF_MAX_RETRIES || '3');
  const BASE_DELAY_MS = parseInt(process.env.NOTIF_BASE_DELAY_MS || '1000');

  async function sendWithRetry(attempt) {
    try {
      if (notification.channel === 'email') {
        if (!recipient.email) {
          const msg = 'No recipient email; skipping email send';
          console.warn(msg, notification.recipient_id || notification.recipient_addr);
          if (notification.id) await db.query('UPDATE notifications SET status=?, last_error=? WHERE id=?', ['skipped', msg, notification.id]);
          return false;
        }
        const subject = renderSubject(notification.template, payload);
        const body = renderBody(notification.template, payload);
        await smtp.send({ to: recipient.email, subject, text: body });
      } else {
        console.log('Would send via', notification.channel, 'to', notification.recipient_addr);
      }

      if (notification.id) await db.query('UPDATE notifications SET status=?, sent_at=? WHERE id=?', ['sent', new Date(), notification.id]);
      console.log('Notification sent for event', eventType, 'to', notification.recipient_addr);
      return true;
    } catch (err) {
      console.error('Send attempt', attempt, 'failed:', err.message);
      try {
        if (notification.id) await db.query('UPDATE notifications SET last_error=?, attempts=? WHERE id=?', [err.message, attempt, notification.id]);
      } catch (e) {}

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, delay));
        return sendWithRetry(attempt + 1);
      }

      // exhausted retries -> publish to DLQ
      try {
        await mq.publish('notifications.dlq', { originalEvent: payload, routingKey: routingKey, failedAt: Date.now(), attempts: attempt }, { persistent: true });
        console.warn('Published to DLQ notifications.dlq for', notification.recipient_addr);
      } catch (e) {
        console.error('Failed to publish to DLQ:', e.message);
      }

      if (notification.id) await db.query('UPDATE notifications SET status=?, last_error=? WHERE id=?', ['failed', err.message, notification.id]);
      return false;
    }
  }

  // start first attempt
  await sendWithRetry(1);
}

function extractRecipient(payload) {
  if (!payload) return null;
  if (payload.patientId || payload.patientName) {
    return { id: payload.patientId || null, email: payload.patientEmail || payload.email || null, phone: payload.patientPhone || payload.phone || null };
  }
  if (payload.userId) return { id: payload.userId, email: payload.email, phone: payload.phone };
  return null;
}

function renderSubject(template, payload) {
  if (template === 'appointment_confirmation') return `预约确认 - ${payload && payload.clinicTime || ''}`;
  if (template === 'waitlist_promotion') return `候补已提升`;
  return '通知';
}

function renderBody(template, payload) {
  if (template === 'appointment_confirmation') return `尊敬的${payload.patientName || ''}，您的预约已确认，时间：${payload.clinicTime || ''}，医生：${payload.doctorName || ''}`;
  if (template === 'waitlist_promotion') return `尊敬的${payload.patientName || ''}，您已从候补队列中被提升，请尽快确认。`;
  return JSON.stringify(payload);
}

module.exports = { processEvent };
