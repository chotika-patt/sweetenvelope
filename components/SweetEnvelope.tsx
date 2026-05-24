"use client";

import { useState, useEffect, useCallback } from "react";
import { PEOPLE, ACCOUNTS } from "@/lib/data";
import { Letter, Person } from "@/types";
import Image from "next/image";

/* ── helpers ── */
function thaiDate(d: Date) {
  const M = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Tab = "write" | "inbox" | "sent";
type Page = "login" | "dashboard" | "write-letter" | "success";

interface CurrentUser {
  personId: number;
  username: string;
}

export default function SweetEnvelope() {
  const [page, setPage] = useState<Page>("login");
  const [tab, setTab] = useState<Tab>("write");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [currentPerson, setCurrentPerson] = useState<Person | null>(null);

  /* login form */
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  /* letters */
  const [inbox, setInbox] = useState<Letter[]>([]);
  const [sent, setSent] = useState<Letter[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [sentLoading, setSentLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  /* write form */
  const [letterBody, setLetterBody] = useState("");
  const [senderName, setSenderName] = useState("");
  const [anon, setAnon] = useState(false);
  const [sending, setSending] = useState(false);

  /* modal */
  const [openLetter, setOpenLetter] = useState<Letter | null>(null);
  const [openSent, setOpenSent] = useState<Letter | null>(null);

  const [showPass, setShowPass] = useState(false);

  /* ── fetch inbox ── */
  const fetchInbox = useCallback(async (personId: number) => {
    setInboxLoading(true);
    try {
      const r = await fetch(`/api/letters?to=${personId}`);
      const d = await r.json();
      const letters = d.letters ?? [];
      setInbox(letters);
      setUnreadCount(letters.filter((l: Letter) => !l.read).length); // ← เพิ่มบรรทัดนี้
    } finally {
      setInboxLoading(false);
    }
  }, []);

  /* ── fetch sent ── */
  const fetchSent = useCallback(async (personId: number) => {
    setSentLoading(true);
    try {
      const r = await fetch(`/api/letters?sentBy=${personId}`);
      const d = await r.json();
      setSent(d.letters ?? []);
    } finally {
      setSentLoading(false);
    }
  }, []);

  /* ── switch tab ── */
  const switchTab = (t: Tab) => {
    setTab(t);
    if (!currentUser) return;
    if (t === "inbox") fetchInbox(currentUser.personId);
    if (t === "sent") fetchSent(currentUser.personId);
  };

  /* ── login ── */
  const doLogin = async () => {
    setLoginLoading(true);
    setLoginErr(false);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUser.trim(),
          password: loginPass,
        }),
      });
      if (!r.ok) {
        setLoginErr(true);
        setLoginPass("");
        return;
      }
      const data = await r.json();
      setCurrentUser(data);
      setLoginUser("");
      setLoginPass("");
      setTab("write");
      setPage("dashboard");
    } finally {
      setLoginLoading(false);
    }
  };

  /* ── send letter ── */
  const sendLetter = async () => {
    if (!letterBody.trim() || !currentPerson) return;
    setSending(true);
    try {
      const me = currentUser
        ? PEOPLE.find((p) => p.id === currentUser.personId)
        : null;
      const from = anon
        ? "นิรนาม 🤫"
        : senderName.trim() || me?.name || "ไม่ระบุชื่อ";
      await fetch("/api/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: currentPerson.id,
          from,
          anon,
          letterBody: letterBody.trim(),
          date: thaiDate(new Date()),
          sentByPersonId: currentUser?.personId ?? null,
        }),
      });
      if (currentPerson) localStorage.removeItem(`draft_${currentPerson.id}`);
      setPage("success");
    } finally {
      setSending(false);
    }
  };

  /* ── mark as read ── */
  const markRead = async (letter: Letter) => {
    if (letter.read) return;
    await fetch(`/api/letters/${letter.id}/read`, { method: "PATCH" });
    setInbox((prev) =>
      prev.map((l) => (l.id === letter.id ? { ...l, read: true } : l)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1)); // ← เพิ่มบรรทัดนี้
  };

  /* ── open write page ── */
  /* ── draft key ── */
  const draftKey = currentPerson ? `draft_${currentPerson.id}` : null;

  /* ── โหลด draft เมื่อเปิดหน้าเขียน ── */
  const openWrite = (p: Person) => {
    setCurrentPerson(p);
    setAnon(false);
    const me = currentUser
      ? PEOPLE.find((x) => x.id === currentUser.personId)
      : null;
    setSenderName(me?.name ?? "");

    // โหลด draft ถ้ามี
    const saved = localStorage.getItem(`draft_${p.id}`);
    if (saved) {
      try {
        const { body, anon: savedAnon, name } = JSON.parse(saved);
        setLetterBody(body ?? "");
        setAnon(savedAnon ?? false);
        if (!savedAnon) setSenderName(name ?? me?.name ?? "");
      } catch {
        setLetterBody("");
      }
    } else {
      setLetterBody("");
    }

    setPage("write-letter");
  };

  /* ── auto-save draft ทุกครั้งที่พิมพ์ ── */
  useEffect(() => {
    if (page !== "write-letter" || !currentPerson) return;
    const key = `draft_${currentPerson.id}`;
    if (!letterBody && !anon) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(
      key,
      JSON.stringify({
        body: letterBody,
        anon,
        name: senderName,
      }),
    );
  }, [letterBody, anon, senderName, currentPerson, page]);

  /* ── written-to set ── */
  const writtenTo = new Set(sent.map((l) => l.to));

  /* ── load on mount after login ── */
  useEffect(() => {
    if (currentUser && page === "dashboard") {
      fetchSent(currentUser.personId);
      fetchInbox(currentUser.personId); // ← เปลี่ยนจาก fetchUnreadCount
    }
  }, [currentUser]);

  /* ── polling badge ทุก 30 วิ ── */
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      fetchInbox(currentUser.personId);
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUser, fetchInbox]);

  const me = currentUser
    ? PEOPLE.find((p) => p.id === currentUser.personId)
    : null;
  const unread = inbox.filter((l) => !l.read).length;

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <>
      {/* floating decos */}
      <div style={decoBase()} className="deco1">
        🌸
      </div>
      <div style={decoBase()} className="deco2">
        ⭐
      </div>
      <div style={decoBase()} className="deco3">
        🌷
      </div>
      <div style={decoBase()} className="deco4">
        💫
      </div>

      {/* header */}
      <header style={styles.header}>
        <div
          style={styles.logo}
          onClick={() =>
            currentUser ? setPage("dashboard") : setPage("login")
          }
        >
          💌 SweetEnvelope
        </div>
        <nav>
          {currentUser && (
            <button
              style={styles.navBtn}
              onClick={() => {
                setCurrentUser(null);
                setPage("login");
              }}
            >
              🚪 ออกจากระบบ
            </button>
          )}
        </nav>
      </header>

      {/* ── LOGIN ── */}
      {page === "login" && (
        <main style={styles.centerPage}>
          <div style={styles.card}>
            <div style={{ fontSize: 54, marginBottom: 12 }}>💌</div>
            <h2 style={styles.cardTitle}>SweetEnvelope</h2>
            <p style={styles.cardSub}>เข้าสู่ระบบเพื่อส่งและรับซองกระจก 🌸</p>

            <input
              style={styles.input}
              placeholder="ชื่อผู้ใช้"
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doLogin()}
              autoComplete="username"
            />

            <div style={{ position: "relative", marginTop: 10 }}>
              <input
                style={{ ...styles.input, paddingRight: 44 }}
                type={showPass ? "text" : "password"}
                placeholder="รหัสผ่าน"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doLogin()}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  color: "#9B8AAB",
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>

            <button
              style={{
                ...styles.primaryBtn,
                marginTop: 16,
                width: "100%",
                opacity: loginLoading ? 0.7 : 1,
              }}
              onClick={doLogin}
              disabled={loginLoading}
            >
              {loginLoading ? "⏳ กำลังเข้าสู่ระบบ..." : "💌 เข้าสู่ระบบ"}
            </button>

            {loginErr && (
              <div style={styles.errBox}>ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง</div>
            )}
          </div>
        </main>
      )}

      {/* ── DASHBOARD ── */}
      {page === "dashboard" && currentUser && (
        <div>
          {/* greeting */}
          <div style={styles.dashHero} className="dash-hero">
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={styles.dashAvatar}>
                {me?.photo ? (
                  <img
                    src={me.photo}
                    alt={me.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  (me?.emoji ?? "👤")
                )}
              </div>
              {/* จุดแจ้งเตือน */}
              {unreadCount > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    background: "#E8748A",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    minWidth: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #fff",
                    padding: "0 4px",
                  }}
                >
                  {unreadCount}
                </div>
              )}
            </div>
            <div>
              <div
                style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}
              >
                สวัสดี, {me?.name ?? currentUser.username}! 👋
              </div>
            </div>
          </div>

          {/* tabs */}
          <div style={styles.tabs} className="tabs">
            {(["write", "inbox", "sent"] as Tab[]).map((t) => {
              const labels: Record<Tab, string> = {
                write: "✉️ เขียนถึงใครสักคน",
                inbox: "📬 กล่องจดหมาย",
                sent: "📤 ที่เคยส่งไป",
              };

              return (
                <button
                  key={t}
                  style={{
                    ...styles.tabBtn,
                    ...(tab === t ? styles.tabActive : {}),
                  }}
                  className="tab-btn"
                  onClick={() => switchTab(t)}
                >
                  {labels[t]}
                  {/* badge unread */}
                  {t === "inbox" && unreadCount > 0 && (
                    <span
                      style={{
                        marginLeft: 6,
                        background: "#E8748A",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 999,
                        padding: "1px 7px",
                        verticalAlign: "middle",
                        display: "inline-block",
                        lineHeight: "18px",
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* tab: write */}
          {tab === "write" && (
            <>
              <h2
                style={{
                  textAlign: "center",
                  padding: "4px 0 14px",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                🌟 เลือกซองที่จะเขียนถึง
              </h2>
              <div style={styles.grid} className="people-grid">
                {PEOPLE.filter((p) => p.id !== currentUser.personId).map(
                  (p) => {
                    const written = writtenTo.has(p.id);
                    return (
                      <div
                        key={p.id}
                        style={{
                          ...styles.personCard,
                          ...(written ? styles.writtenCard : {}),
                        }}
                        className="person-card"
                        onClick={() => openWrite(p)}
                        tabIndex={0}
                        onKeyDown={(e) =>
                          (e.key === "Enter" || e.key === " ") && openWrite(p)
                        }
                      >
                        <div
                          style={styles.personAvatar}
                          className="person-avatar"
                        >
                          {p.photo ? (
                            <Image
                              src={p.photo}
                              alt={p.name}
                              width={76}
                              height={76}
                              style={{
                                objectFit: "cover",
                                borderRadius: "50%",
                              }}
                            />
                          ) : (
                            p.emoji
                          )}
                        </div>
                        <div style={styles.personName}>{p.name}</div>
                        <div style={styles.personTag}>{p.tag}</div>
                        {written && (
                          <div style={styles.writtenTag}>✓ เขียนแล้ว</div>
                        )}
                        <button
                          style={styles.writeCardBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            openWrite(p);
                          }}
                        >
                          ✉️ เขียนถึง
                        </button>
                      </div>
                    );
                  },
                )}
              </div>
            </>
          )}

          {/* tab: inbox */}
          {tab === "inbox" && (
            <div
              style={{
                maxWidth: 720,
                margin: "0 auto",
                padding: "0 20px 60px",
              }}
            >
              <div style={styles.infoBar}>
                📨 <strong>{inbox.length}</strong> ฉบับ &nbsp;•&nbsp; ยังไม่อ่าน{" "}
                <strong>{unread}</strong> ฉบับ
              </div>
              {inboxLoading && (
                <div style={styles.emptyState}>⏳ กำลังโหลด...</div>
              )}
              {!inboxLoading && inbox.length === 0 && (
                <div style={styles.emptyState}>
                  <span style={{ fontSize: 52 }}>📭</span>
                  <br />
                  ยังไม่มีจดหมายสักฉบับเลย 🌸
                </div>
              )}
              {inbox.map((l) => (
                <div
                  key={l.id}
                  style={styles.letterItem}
                  onClick={() => {
                    setOpenLetter(l);
                    markRead(l);
                  }}
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" && (setOpenLetter(l), markRead(l))
                  }
                >
                  {!l.read && <div style={styles.unreadDot} />}
                  <div style={styles.letterFrom}>
                    {l.anon ? "🤫" : "👤"} จาก: <strong>{l.from}</strong>
                    {l.anon && (
                      <span style={styles.badgeAnon}>ไม่ระบุชื่อ</span>
                    )}
                  </div>
                  <div style={styles.letterPreview}>{l.body}</div>
                  <div style={styles.letterDate}>📅 {l.date}</div>
                </div>
              ))}
            </div>
          )}

          {/* tab: sent */}
          {tab === "sent" && (
            <div
              style={{
                maxWidth: 720,
                margin: "0 auto",
                padding: "0 20px 60px",
              }}
            >
              <div style={styles.infoBar}>
                📤 ส่งไปแล้ว <strong>{sent.length}</strong> ฉบับ
              </div>
              {sentLoading && (
                <div style={styles.emptyState}>⏳ กำลังโหลด...</div>
              )}
              {!sentLoading && sent.length === 0 && (
                <div style={styles.emptyState}>
                  <span style={{ fontSize: 52 }}>📮</span>
                  <br />
                  ยังไม่เคยส่งจดหมายให้ใครเลย 🌸
                </div>
              )}
              {sent.map((l) => {
                const toPerson = PEOPLE.find((p) => p.id === l.to);
                return (
                  <div
                    key={l.id}
                    style={{ ...styles.letterItem, borderColor: "#B5DEB5" }}
                    onClick={() => setOpenSent(l)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setOpenSent(l)}
                  >
                    <div style={styles.letterFrom}>
                      {toPerson?.emoji ?? "👤"} ถึง:{" "}
                      <strong>{toPerson?.name ?? "?"}</strong>
                      {l.anon && (
                        <span style={styles.badgeAnon}>ส่งแบบไม่ระบุชื่อ</span>
                      )}
                    </div>
                    <div style={styles.letterPreview}>{l.body}</div>
                    <div style={styles.letterDate}>📅 {l.date}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── WRITE LETTER ── */}
      {page === "write-letter" && currentPerson && (
        <div
          style={{ maxWidth: 700, margin: "0 auto", padding: "24px 20px 60px" }}
        >
          {/* recipient card */}
          <div
            style={{
              ...styles.card,
              flexDirection: "row",
              gap: 18,
              alignItems: "center",
              marginBottom: 18,
              padding: 22,
            }}
          >
            <div style={styles.personAvatarLg}>
              {currentPerson.photo ? (
                <Image
                  src={currentPerson.photo}
                  alt={currentPerson.name}
                  width={84}
                  height={84}
                  style={{ objectFit: "cover", borderRadius: "50%" }}
                />
              ) : (
                currentPerson.emoji
              )}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                ถึง {currentPerson.name}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--text-light)",
                  marginTop: 4,
                }}
              >
                เขียนจดหมายให้เขา/เธอ 💌
              </div>
            </div>
          </div>

          {/* envelope paper */}
          <div
            style={{
              background: "rgba(255,255,255,0.96)",
              borderRadius: 24,
              border: "2px solid var(--blue-light)",
              padding: "30px 26px 24px",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -16,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 30,
                background: "var(--white)",
                padding: "0 10px",
                lineHeight: 1,
              }}
            >
              💌
            </div>

            {/* anon toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--blue-light)",
                border: "1.5px solid var(--blue)",
                borderRadius: 12,
                padding: "10px 16px",
                cursor: "pointer",
                marginBottom: 18,
              }}
              onClick={() => {
                setAnon(!anon);
                if (!anon) setSenderName("");
              }}
            >
              <input
                type="checkbox"
                checked={anon}
                readOnly
                style={{
                  width: 17,
                  height: 17,
                  accentColor: "var(--blue-dark)",
                }}
              />
              <label
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--blue-dark)",
                  cursor: "pointer",
                }}
              >
                ส่งแบบไม่ระบุชื่อ (ลับๆ 🤫)
              </label>
            </div>

            {/* sender name */}
            <div style={{ marginBottom: 18 }}>
              <div style={styles.formLabel}>✏️ ชื่อของคุณ</div>
              <input
                style={{ ...styles.input, opacity: anon ? 0.4 : 1 }}
                placeholder="ใส่ชื่อของคุณ..."
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                disabled={anon}
                maxLength={50}
              />
            </div>

            {/* letter body */}
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 7,
                }}
              >
                <div style={styles.formLabel}>💬 เนื้อหาจดหมาย</div>
                {letterBody.length > 0 && (
                  <div style={{ fontSize: 11, color: "#9B8AAB" }}>
                    ✓ บันทึกอัตโนมัติแล้ว
                  </div>
                )}
              </div>
              <textarea
                style={styles.textarea}
                placeholder="เขียนความรู้สึกของคุณที่นี่... 🌸"
                value={letterBody}
                onChange={(e) => setLetterBody(e.target.value)}
                maxLength={2000}
                rows={8}
              />
              <div
                style={{
                  textAlign: "right",
                  fontSize: 12,
                  color: "var(--text-light)",
                  marginTop: 4,
                }}
              >
                {letterBody.length} / 2000 ตัวอักษร
              </div>
            </div>

            <button
              style={{
                ...styles.primaryBtn,
                width: "100%",
                fontSize: 17,
                padding: 14,
                opacity: sending ? 0.7 : 1,
              }}
              onClick={sendLetter}
              disabled={sending || !letterBody.trim()}
            >
              {sending ? "⏳ กำลังส่ง..." : "📮 ส่งซองกระจก"}
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button style={styles.navBtn} onClick={() => setPage("dashboard")}>
              ← กลับ
            </button>
          </div>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {page === "success" && (
        <main style={styles.centerPage}>
          <div style={{ ...styles.card, textAlign: "center" }}>
            <div style={{ fontSize: 68, marginBottom: 16 }}>🎉</div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "var(--pink-dark)",
                marginBottom: 10,
              }}
            >
              ส่งสำเร็จแล้ว!
            </div>
            <div
              style={{
                fontSize: 15,
                color: "var(--text-light)",
                lineHeight: 1.7,
              }}
            >
              จดหมายของคุณถูกส่งเรียบร้อยแล้ว
              <br />
              รอให้เขา/เธอได้อ่านนะ 💕
            </div>
            <button
              style={{
                ...styles.primaryBtn,
                marginTop: 26,
                padding: "12px 30px",
                background: "linear-gradient(135deg,#B3D9F7,#5AAEE0)",
              }}
              onClick={() => {
                setPage("dashboard");
                switchTab("write");
                fetchSent(currentUser!.personId);
              }}
            >
              🏠 กลับหน้าหลัก
            </button>
          </div>
        </main>
      )}

      {/* ── MODAL: inbox letter ── */}
      {openLetter && (
        <div
          style={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenLetter(null);
          }}
        >
          <div style={styles.modalBox}>
            <button
              style={styles.modalClose}
              onClick={() => setOpenLetter(null)}
            >
              ✕
            </button>
            <div style={{ textAlign: "center", fontSize: 36, marginBottom: 8 }}>
              💌
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--text-light)",
                textAlign: "center",
                marginBottom: 18,
              }}
            >
              จาก: <strong>{openLetter.from}</strong>
            </div>
            <div style={styles.modalBody}>{openLetter.body}</div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-light)",
                textAlign: "right",
                marginTop: 16,
              }}
            >
              📅 {openLetter.date}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: sent letter ── */}
      {openSent && (
        <div
          style={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenSent(null);
          }}
        >
          <div style={styles.modalBox}>
            <button style={styles.modalClose} onClick={() => setOpenSent(null)}>
              ✕
            </button>
            <div style={{ textAlign: "center", fontSize: 36, marginBottom: 8 }}>
              📤
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--text-light)",
                textAlign: "center",
                marginBottom: 18,
              }}
            >
              ถึง:{" "}
              <strong>
                {PEOPLE.find((p) => p.id === openSent.to)?.name ?? "?"}
              </strong>
              {openSent.anon && (
                <span style={{ ...styles.badgeAnon, marginLeft: 8 }}>
                  ไม่ระบุชื่อ
                </span>
              )}
            </div>
            <div style={styles.modalBody}>{openSent.body}</div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-light)",
                textAlign: "right",
                marginTop: 16,
              }}
            >
              📅 {openSent.date}
            </div>
          </div>
        </div>
      )}

      <style>
        {`
  :root {
    --pink-light: #FFE4EC; --pink: #FFB7C5; --pink-dark: #E8748A;
    --blue-light: #E3F3FF; --blue: #B3D9F7; --blue-dark: #5AAEE0;
    --yellow: #FFF0A8; --white: #FFFDF9;
    --text: #5A4A6A; --text-light: #9B8AAB;
  }
  .deco1,.deco2,.deco3,.deco4 {
    position:fixed; pointer-events:none; z-index:0;
    font-size:36px; opacity:0.15; user-select:none;
  }
  .deco1 { top:8%; left:3%; animation: fl 6s ease-in-out infinite; }
  .deco2 { top:15%; right:5%; animation: fl 8s ease-in-out infinite 1s; }
  .deco3 { bottom:22%; left:6%; animation: fl 7s ease-in-out infinite 2s; }
  .deco4 { bottom:10%; right:4%; animation: fl 9s ease-in-out infinite 0.5s; }
  @keyframes fl {
    0%,100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-18px) rotate(8deg); }
  }

  /* ── RESPONSIVE ── */

  /* มือถือ */
  @media (max-width: 480px) {
    .people-grid {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 10px !important;
      padding: 0 12px 50px !important;
    }
    .person-card {
      padding: 16px 10px 14px !important;
    }
    .person-avatar {
      width: 72px !important;
      height: 72px !important;
    }
    .dash-hero {
      padding: 16px 14px 12px !important;
    }
    .tabs {
      padding: 0 12px 12px !important;
      gap: 6px !important;
    }
    .tab-btn {
      padding: 8px 12px !important;
      font-size: 12px !important;
    }
    .header {
      padding: 10px 14px !important;
    }
  }

  /* แท็บเล็ต */
  @media (min-width: 481px) and (max-width: 768px) {
    .people-grid {
      grid-template-columns: repeat(3, 1fr) !important;
    }
  }

  /* hover effect สำหรับ desktop */
  @media (hover: hover) {
    .person-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 10px 28px rgba(255,183,197,0.4);
    }
  }
`}
      </style>
      {/* ── FOOTER ── */}
      <footer
        style={{
          textAlign: "center",
          padding: "20px",
          fontSize: 13,
          color: "#9B8AAB",
          marginTop: 20,
        }}
      >
        หากพบปัญหาติดต่อ{" "}
        <a
          href="https://instagram.com/_k.xt0r"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#E8748A", fontWeight: 600, textDecoration: "none" }}
        >
          @_k.xt0r
        </a>
      </footer>
    </>
  );
}

function decoBase(): React.CSSProperties {
  return {
    position: "fixed",
    pointerEvents: "none",
    zIndex: 0,
    fontSize: 36,
    opacity: 0.15,
    userSelect: "none",
  };
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 24px",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(12px)",
    borderBottom: "2px dashed #FFB7C5",
  },
  logo: {
    fontSize: 20,
    fontWeight: 700,
    color: "#E8748A",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  navBtn: {
    background: "#FFE4EC",
    border: "1.5px solid #FFB7C5",
    color: "#E8748A",
    padding: "7px 16px",
    borderRadius: 20,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  centerPage: {
    minHeight: "80vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    background: "rgba(255,255,255,0.96)",
    borderRadius: 32,
    border: "2px solid #FFE4EC",
    padding: "40px 34px",
    maxWidth: 400,
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#E8748A",
    marginBottom: 6,
  },
  cardSub: { fontSize: 14, color: "#9B8AAB", marginBottom: 26 },
  input: {
    width: "100%",
    padding: "11px 16px",
    border: "1.5px solid #FFE4EC",
    borderRadius: 18,
    fontSize: 15,
    color: "#5A4A6A",
    background: "#FFFDF9",
    outline: "none",
  },
  primaryBtn: {
    background: "linear-gradient(135deg,#E8748A,#C84B6E)",
    border: "none",
    color: "#fff",
    padding: "13px 28px",
    borderRadius: 18,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  errBox: {
    color: "#E24B4A",
    fontSize: 13,
    marginTop: 10,
    padding: "8px 12px",
    background: "#FEF2F2",
    borderRadius: 12,
  },
  hintBox: {
    marginTop: 18,
    fontSize: 12,
    color: "#9B8AAB",
    background: "#FFF0A8",
    borderRadius: 12,
    padding: "6px 12px",
    textAlign: "center",
  },
  dashHero: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "28px 24px 20px",
    maxWidth: 960,
    margin: "0 auto",
    zIndex: 1,
    position: "relative",
  },
  dashAvatar: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#FFE4EC,#E3F3FF)",
    border: "3px solid #FFB7C5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
    flexShrink: 0,
  },
  tabs: {
    display: "flex",
    gap: 8,
    padding: "0 20px 16px",
    maxWidth: 960,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
    overflowX: "auto",
  },
  tabBtn: {
    flexShrink: 0,
    background: "rgba(255,255,255,0.8)",
    border: "2px solid #FFE4EC",
    color: "#9B8AAB",
    padding: "10px 20px",
    borderRadius: 20,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "all 0.2s",
  },
  tabActive: {
    background: "linear-gradient(135deg,#FFB7C5,#FF8FAB)",
    borderColor: "#E8748A",
    color: "#fff",
    boxShadow: "0 4px 14px rgba(255,143,171,0.35)",
  },
  infoBar: {
    textAlign: "center",
    background: "#FFE4EC",
    border: "1.5px solid #FFB7C5",
    borderRadius: 18,
    padding: "10px 20px",
    marginBottom: 16,
    fontSize: 14,
    color: "#E8748A",
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 16,
    padding: "0 20px 60px",
    maxWidth: 1100,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  personCard: {
    background: "rgba(255,255,255,0.92)",
    borderRadius: 24,
    border: "2px solid #FFE4EC",
    padding: "22px 14px 18px",
    textAlign: "center",
    cursor: "pointer",
    transition: "transform 0.22s, box-shadow 0.22s",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  writtenCard: { borderColor: "#B5DEB5", background: "rgba(240,255,240,0.92)" },
  personAvatar: {
    width: 90,
    height: 90,
    borderRadius: "50%",
    margin: "0 auto 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg,#FFE4EC,#E3F3FF)",
    border: "3px solid #FFB7C5",
    fontSize: 34,
    overflow: "hidden",
  },
  personAvatarLg: {
    width: 84,
    height: 84,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg,#FFE4EC,#E3F3FF)",
    border: "3px solid #FFB7C5",
    fontSize: 34,
    flexShrink: 0,
  },
  personName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#5A4A6A",
    marginBottom: 5,
  },

  personTag: {
    display: "block", // ← เปลี่ยนจาก inline-block
    width: "100%", // ← เพิ่ม
    fontSize: 12,
    color: "#A07800",
    background: "#FFF0A8",
    borderRadius: 10,
    padding: "3px 10px",
    marginBottom: 2,
  },

  writtenTag: {
    display: "block", // ← เปลี่ยนจาก inline-block
    width: "100%", // ← เพิ่ม
    fontSize: 11,
    fontWeight: 700,
    color: "#2E7D32",
    background: "#E8F5E9",
    border: "1.5px solid #A5D6A7",
    borderRadius: 10,
    padding: "2px 9px",
    marginBottom: 2,
  },

  writeCardBtn: {
    background: "linear-gradient(135deg,#FFB7C5,#FF8FAB)",
    border: "none",
    color: "#fff",
    padding: "7px 14px",
    borderRadius: 14,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    width: "100%", // ← เพิ่ม ให้กว้างเต็ม
    marginTop: 4, // ← เพิ่ม
  },
  formLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#9B8AAB",
    marginBottom: 7,
  },
  textarea: {
    width: "100%",
    minHeight: 210,
    paddingTop: "8px",
    paddingBottom: "14px",
    paddingLeft: "16px",
    paddingRight: "16px",
    border: "1.5px dashed #FFB7C5",
    borderRadius: 18,
    fontSize: 15,
    lineHeight: "29px",
    color: "#5A4A6A",
    background:
      "repeating-linear-gradient(transparent, transparent 28px, rgba(255,183,197,0.35) 28px, rgba(255,183,197,0.35) 29px)",
    backgroundPosition: "0 0",
    backgroundAttachment: "local",
    outline: "none",
    resize: "vertical",
  },
  letterItem: {
    background: "rgba(255,255,255,0.93)",
    borderRadius: 24,
    border: "2px solid #E3F3FF",
    padding: "18px 22px 16px 26px",
    marginBottom: 14,
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
  },
  letterFrom: {
    fontSize: 13,
    color: "#9B8AAB",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  letterPreview: {
    fontSize: 15,
    color: "#5A4A6A",
    lineHeight: 1.5,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } as React.CSSProperties,
  letterDate: { fontSize: 12, color: "#9B8AAB", marginTop: 8 },
  badgeAnon: {
    background: "#FFF0A8",
    color: "#A07800",
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 10,
  },
  unreadDot: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 11,
    height: 11,
    background: "#E8748A",
    borderRadius: "50%",
  },
  emptyState: {
    textAlign: "center",
    padding: "50px 20px",
    color: "#9B8AAB",
    fontSize: 16,
    lineHeight: 2,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(90,74,106,0.52)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: 20,
  },
  modalBox: {
    background: "#fff",
    borderRadius: 32,
    padding: "32px 28px",
    maxWidth: 580,
    width: "100%",
    maxHeight: "88vh",
    overflowY: "auto",
    position: "relative",
    border: "2px solid #FFE4EC",
  },
  modalClose: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    background: "#FFE4EC",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: 18,
    color: "#E8748A",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    fontSize: 16,
    lineHeight: 1.85,
    color: "#5A4A6A",
    background:
      "repeating-linear-gradient(transparent,transparent 28px,rgba(255,183,197,0.2) 28px,rgba(255,183,197,0.2) 29px)",
    backgroundPosition: "0 34px",
    padding: "8px 10px",
    borderRadius: 12,
    minHeight: 120,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
};
