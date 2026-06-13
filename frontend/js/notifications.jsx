// Akira AI — Notifications popover dropdown (top-bar bell menu)
(function () {
  const React = window.React;
  const { useState, useEffect, useCallback } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const API = window.AkiraAPI;

  function NotificationsPopover({ onClose, nav, toast, setUnreadCount }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
      setLoading(true); setError(null);
      try {
        const res = await API.notifications.list({ limit: 20 });
        // Response is wrapped in envelope, list unrolls as items or direct array
        const list = (res && res.items) ? res.items : (Array.isArray(res) ? res : []);
        setItems(list);
        
        // Also refresh unread count
        const countRes = await API.notifications.unreadCount();
        const count = countRes && typeof countRes.count === "number" ? countRes.count : (typeof countRes === "number" ? countRes : 0);
        setUnreadCount(count);
      } catch (e) {
        setError((e && e.message) || "Failed to load notifications");
      } finally {
        setLoading(false);
      }
    }, [setUnreadCount]);

    useEffect(() => {
      load();
    }, [load]);

    // Handle outside clicks to close the popover
    useEffect(() => {
      function handleClick(e) {
        const pop = document.getElementById("vs-notif-popover");
        const bellBtn = document.getElementById("vs-bell-btn");
        if (pop && !pop.contains(e.target) && bellBtn && !bellBtn.contains(e.target)) {
          onClose();
        }
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [onClose]);

    const markRead = async (id, e) => {
      if (e) e.stopPropagation();
      try {
        await API.notifications.markRead(id);
        setItems((prev) => prev.map((item) => item.id === id ? { ...item, read: true } : item));
        
        // Refresh unread count
        const countRes = await API.notifications.unreadCount();
        const count = countRes && typeof countRes.count === "number" ? countRes.count : (typeof countRes === "number" ? countRes : 0);
        setUnreadCount(count);
      } catch (err) {
        toast && toast({ kind: "error", msg: "Couldn't mark notification as read" });
      }
    };

    const deleteNotif = async (id, e) => {
      if (e) e.stopPropagation();
      try {
        await API.notifications.remove(id);
        setItems((prev) => prev.filter((item) => item.id !== id));
        
        // Refresh unread count
        const countRes = await API.notifications.unreadCount();
        const count = countRes && typeof countRes.count === "number" ? countRes.count : (typeof countRes === "number" ? countRes : 0);
        setUnreadCount(count);
      } catch (err) {
        toast && toast({ kind: "error", msg: "Couldn't delete notification" });
      }
    };

    const markAllRead = async () => {
      try {
        await API.notifications.readAll();
        setItems((prev) => prev.map((item) => ({ ...item, read: true })));
        setUnreadCount(0);
        toast && toast({ kind: "success", msg: "All notifications marked as read" });
      } catch (err) {
        toast && toast({ kind: "error", msg: "Failed to mark all as read" });
      }
    };

    const handleClick = async (item) => {
      if (!item.read) {
        await markRead(item.id);
      }
      onClose();
      if (item.link) {
        const { scan_id, repository_id } = item.link;
        if (scan_id) {
          nav("report", scan_id);
        } else if (repository_id) {
          nav("watchlist");
        }
      }
    };

    const getTypeStyles = (type) => {
      switch (type) {
        case "scan_complete":
          return { icon: Icons.check, bg: "var(--sev-clean-bg)", color: "var(--sev-clean)" };
        case "critical_found":
          return { icon: Icons.alert, bg: "var(--sev-critical-bg)", color: "var(--sev-critical)" };
        case "watchlist_changed":
          return { icon: Icons.refresh, bg: "var(--accent-soft)", color: "var(--accent)" };
        default:
          return { icon: Icons.bell, bg: "var(--bg-active)", color: "var(--text-2)" };
      }
    };

    const fmtTime = (dt) => {
      if (!dt) return "";
      try {
        const diff = Date.now() - new Date(dt).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return mins + "m ago";
        const hours = Math.floor(mins / 60);
        if (hours < 24) return hours + "h ago";
        return new Date(dt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      } catch (e) {
        return "";
      }
    };

    return h("div", {
      id: "vs-notif-popover",
      className: "popover",
      style: {
        top: "calc(100% + 8px)",
        right: 0,
        width: 360,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        maxHeight: 440,
        boxShadow: "var(--shadow-dropdown)",
        zIndex: 1000
      }
    },
      // Header
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" } },
        h("span", { style: { fontSize: 13.5, fontWeight: 650 } }, "Notifications"),
        items.some(x => !x.read) && h("button", {
          className: "btn btn-ghost btn-sm",
          style: { padding: "2px 6px", fontSize: 11.5, color: "var(--accent)" },
          onClick: markAllRead
        }, "Mark all read")),

      // Body / List
      h("div", { style: { overflowY: "auto", flex: 1 } },
        loading
          ? h("div", { style: { display: "flex", justifyContent: "center", alignItems: "center", padding: "40px 0" } },
              h("div", { className: "spinner", style: { width: 18, height: 18 } }))
          : error
            ? h("div", { style: { padding: 16, fontSize: 12.5, color: "var(--sev-critical)", textAlign: "center" } }, error)
            : items.length === 0
              ? h("div", { style: { padding: "40px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 } },
                  h(Icons.bell, { size: 24, style: { color: "var(--text-3)", opacity: 0.6 } }),
                  h("div", { style: { fontSize: 13, fontWeight: 600 } }, "You're all caught up"),
                  h("div", { style: { fontSize: 11.5, color: "var(--text-3)" } }, "No notifications to show right now."))
              : h("div", { style: { display: "flex", flexDirection: "column" } },
                  items.map((item) => {
                    const styles = getTypeStyles(item.type);
                    const isClickable = !!item.link;
                    return h("div", {
                      key: item.id,
                      onClick: () => handleClick(item),
                      className: "vs-notif-item",
                      style: {
                        display: "flex",
                        gap: 12,
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border)",
                        cursor: isClickable ? "pointer" : "default",
                        background: item.read ? "transparent" : "var(--bg-active)",
                        position: "relative",
                        transition: "background 0.15s ease"
                      },
                      onMouseEnter: (e) => { e.currentTarget.style.background = item.read ? "var(--bg-hover)" : "color-mix(in srgb, var(--bg-active) 85%, var(--text-1) 15%)"; },
                      onMouseLeave: (e) => { e.currentTarget.style.background = item.read ? "transparent" : "var(--bg-active)"; }
                    },
                      // Icon & Unread Dot
                      h("div", { style: { position: "relative", flexShrink: 0 } },
                        h("div", {
                          style: {
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: styles.bg,
                            color: styles.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }
                        }, h(styles.icon, { size: 15 })),
                        !item.read && h("span", {
                          style: {
                            position: "absolute",
                            top: -2,
                            right: -2,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "var(--accent)"
                          }
                        })),

                      // Text Content
                      h("div", { style: { flex: 1, fontSize: 12.5, lineHeight: 1.4 } },
                        h("div", { style: { fontWeight: item.read ? 500 : 600, color: "var(--text-1)" } }, item.title),
                        item.body && h("div", { style: { color: "var(--text-2)", marginTop: 2 } }, item.body),
                        h("div", { style: { fontSize: 11, color: "var(--text-3)", marginTop: 4 } }, fmtTime(item.created_at))),

                      // Action Buttons (Mark read / Delete) on Hover
                      h("div", {
                        className: "notif-actions",
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: 0.8
                        }
                      },
                        !item.read && h("button", {
                          className: "icon-btn btn-sm",
                          title: "Mark as read",
                          onClick: (e) => markRead(item.id, e),
                          style: { padding: 4 }
                        }, h(Icons.check, { size: 12 })),
                        h("button", {
                          className: "icon-btn btn-sm",
                          title: "Delete",
                          onClick: (e) => deleteNotif(item.id, e),
                          style: { padding: 4, color: "var(--sev-critical)" }
                        }, h(Icons.x, { size: 12 })))
                    );
                  }))
      )
    );
  }

  window.NotificationsPopover = NotificationsPopover;
})();
