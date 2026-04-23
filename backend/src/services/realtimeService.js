const subscribers = new Map();
let nextSubscriberId = 1;

const writeEvent = (res, eventName, payload) => {
  const data = JSON.stringify(payload ?? {});
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${data}\n\n`);
};

export const registerRealtimeSubscriber = ({ res, domain, role, userId }) => {
  const id = String(nextSubscriberId++);
  subscribers.set(id, { id, res, domain, role, userId, connectedAt: Date.now() });
  return id;
};

export const unregisterRealtimeSubscriber = (id) => {
  subscribers.delete(String(id));
};

export const broadcastDomainEvent = ({ domain, type, payload = {}, roles = [] }) => {
  const roleFilter = Array.isArray(roles) && roles.length ? new Set(roles) : null;

  for (const [id, subscriber] of subscribers.entries()) {
    if (!subscriber?.res || subscriber.domain !== domain) continue;
    if (roleFilter && !roleFilter.has(subscriber.role)) continue;

    try {
      writeEvent(subscriber.res, "realtime_update", {
        type,
        domain,
        timestamp: new Date().toISOString(),
        payload
      });
    } catch {
      subscribers.delete(id);
    }
  }
};

const HEARTBEAT_MS = 25000;

const heartbeatTimer = setInterval(() => {
  for (const [id, subscriber] of subscribers.entries()) {
    try {
      writeEvent(subscriber.res, "ping", { ts: Date.now() });
    } catch {
      subscribers.delete(id);
    }
  }
}, HEARTBEAT_MS);

heartbeatTimer.unref?.();

export const sendRealtimeConnected = (res, payload) => {
  writeEvent(res, "realtime_connected", payload);
};
