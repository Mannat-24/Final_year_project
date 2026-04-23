const NotificationCenter = ({ notifications = [], onMarkRead }) => {
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">Notifications</h3>
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-slate-500">No notifications yet.</p>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <article key={item._id} className="rounded-xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</h4>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{item.message}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    {new Date(item.createdAt).toLocaleString("en-IN")}
                  </p>
                </div>
                {onMarkRead && !item.isRead ? (
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white dark:bg-slate-200 dark:text-slate-900"
                    onClick={() => onMarkRead(item._id)}
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default NotificationCenter;
