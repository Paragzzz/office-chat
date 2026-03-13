import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
  doc,
  deleteDoc,
  getDocs
} from "firebase/firestore";
import EmojiPicker from "emoji-picker-react";

const users = {
  LG: "Parag@9232",
  RB: "Shubham@8182",
  RC: "Sunny@1111",
  BS: "Dhruvil@sexpal",
  HR: "Bhumika@1000",
  JM: "Adi@3210",
  PB: "Dhruvil@0987"
};

const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPzHeM1vGLr-2r2s";
const TENOR_CLIENT_KEY = "office_chat";

const avatarColors = {
  LG: "#FF6B6B", RB: "#4ECDC4", RC: "#45B7D1",
  BS: "#96CEB4", HR: "#FFEAA7", JM: "#DDA0DD", PB: "#98D8C8"
};

const getInitials = (name) => name.slice(0, 2).toUpperCase();

export default function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [panic, setPanic] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [newMessageAlert, setNewMessageAlert] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [mutedStatus, setMutedStatus] = useState({});
  const [loginError, setLoginError] = useState("");
  const [hoveredMsg, setHoveredMsg] = useState(null);
  const [showGif, setShowGif] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bottomRef = useRef(null);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  let typingTimeout = useRef(null);

  // Close sidebar on outside tap (mobile)
  useEffect(() => {
    const handleClick = (e) => {
      if (sidebarOpen && e.target.classList.contains("sidebar-overlay")) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [sidebarOpen]);

  const login = async () => {
    if (users[username] && users[username] === password) {
      setUser(username);
      setLoginError("");
      await setDoc(doc(db, "activeUsers", username), {
        lastSeen: serverTimestamp(),
        typing: false
      });
      onSnapshot(collection(db, "mutedUsers"), (snapshot) => {
        const status = {};
        snapshot.docs.forEach((d) => { status[d.id] = d.data().muted; });
        setMutedStatus(status);
      });
    } else {
      setLoginError("Invalid username or password");
    }
  };

  const logout = async () => {
    setUser(null);
    await deleteDoc(doc(db, "activeUsers", username));
  };

  const panicMode = () => setPanic(true);

  const triggerEmergency = async () => {
    setEmergencyMode(true);
    const unsub = onSnapshot(collection(db, "activeUsers"), (snapshot) => {
      snapshot.docs.forEach((docSnap) => deleteDoc(doc(db, "activeUsers", docSnap.id)));
    });
    setTimeout(() => unsub(), 5000);
  };

  useEffect(() => {
    if (emergencyMode) return;
    const q = query(collection(db, "messages"), orderBy("time", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const newMsgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(newMsgs);
      const el = messagesRef.current;
      const atBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 80 : true;
      if (atBottom) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        setNewMessageAlert(false);
      } else {
        setNewMessageAlert(true);
      }
    });
    return () => unsub();
  }, [user, emergencyMode]);

  useEffect(() => {
    if (emergencyMode) return;
    const unsub = onSnapshot(collection(db, "activeUsers"), (snapshot) => {
      const usersList = snapshot.docs.map((d) => ({ username: d.id, ...d.data() }));
      setActiveUsers(usersList.map((u) => u.username));
      setTypingUsers(usersList.filter((u) => u.typing && u.username !== user && !mutedStatus[u.username]).map((u) => u.username));
    });
    return () => unsub();
  }, [user, emergencyMode, mutedStatus]);

  const searchGifs = async (q) => {
    setGifQuery(q);
    if (!q.trim()) { setGifResults([]); return; }
    setGifLoading(true);
    try {
      const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=12`);
      const data = await res.json();
      setGifResults(data.results || []);
    } catch (e) { console.error(e); }
    setGifLoading(false);
  };

  const sendGif = async (gifUrl) => {
    if (mutedStatus[user]) return;
    try {
      await addDoc(collection(db, "messages"), {
        user,
        text: gifUrl,
        type: "gif",
        time: serverTimestamp(),
        replyTo: replyTo || null
      });
      setReplyTo(null);
      setShowGif(false);
      setGifQuery("");
      setGifResults([]);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) { console.error(err); }
  };

  const isGifMessage = (m) => m.type === "gif" || m.text?.match(/^https?:\/\/.+\.(gif|gifv)(\?.*)?$/i) || m.text?.includes("media.tenor.com");

  const sendMessage = async () => {
    const text = msg.trim();
    if (!text || mutedStatus[user]) return;
    try {
      await addDoc(collection(db, "messages"), {
        user,
        text,
        time: serverTimestamp(),
        replyTo: replyTo || null
      });
      setMsg("");
      setReplyTo(null);
      setShowEmoji(false);
      if (user) await setDoc(doc(db, "activeUsers", user), { typing: false }, { merge: true });
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setNewMessageAlert(false);
    } catch (err) { console.error(err); }
  };

  const handleTyping = async (e) => {
    setMsg(e.target.value);
    if (user && !mutedStatus[user]) {
      await setDoc(doc(db, "activeUsers", user), { typing: true }, { merge: true });
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(async () => {
      if (user) await setDoc(doc(db, "activeUsers", user), { typing: false }, { merge: true });
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const deleteMessage = async (id) => {
    if (user !== "LG") return;
    await deleteDoc(doc(db, "messages", id));
  };

  const clearAllMessages = async () => {
    if (user !== "LG") return;
    const snapshot = await getDocs(collection(db, "messages"));
    snapshot.forEach(async (docSnap) => await deleteDoc(doc(db, "messages", docSnap.id)));
  };

  const toggleMute = async (u) => {
    if (user !== "LG") return;
    const newStatus = !(mutedStatus[u] || false);
    await setDoc(doc(db, "mutedUsers", u), { muted: newStatus });
    setMutedStatus({ ...mutedStatus, [u]: newStatus });
  };

  if (panic) {
    return (
      <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f5f5f0", fontFamily: "Georgia, serif" }}>
        <div style={{ textAlign: "center", color: "#333" }}>
          <h1 style={{ fontSize: "48px", fontWeight: "300" }}>404</h1>
          <p style={{ fontSize: "18px", color: "#666" }}>Page not found</p>
        </div>
      </div>
    );
  }

  if (emergencyMode) {
    return (
      <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "white", fontFamily: "monospace", fontSize: "22px", color: "#333" }}>
        ⚠ 404 — App temporarily unavailable
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@600&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { height: 100%; }
          body { background: #0f0f13; }
          .login-input {
            width: 100%;
            padding: 14px 18px;
            margin-top: 12px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 12px;
            color: white;
            font-size: 16px;
            font-family: 'DM Sans', sans-serif;
            outline: none;
            transition: all 0.2s;
            -webkit-appearance: none;
          }
          .login-input:focus { border-color: #7C6EF8; background: rgba(124,110,248,0.08); }
          .login-input::placeholder { color: rgba(255,255,255,0.35); }
          .login-btn {
            width: 100%;
            padding: 15px;
            margin-top: 20px;
            background: linear-gradient(135deg, #7C6EF8, #5B8DEF);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-family: 'DM Sans', sans-serif;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            letter-spacing: 0.5px;
            -webkit-tap-highlight-color: transparent;
          }
          .login-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(124,110,248,0.4); }
          .login-btn:active { transform: translateY(0); opacity: 0.9; }
        `}</style>
        <div style={{
          minHeight: "100vh",
          minHeight: "100dvh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0f0f13 0%, #1a1a2e 50%, #16213e 100%)",
          position: "relative",
          overflow: "hidden",
          padding: "20px"
        }}>
          <div style={{ position: "absolute", top: "20%", left: "15%", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(124,110,248,0.15) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(40px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "20%", right: "15%", width: "250px", height: "250px", background: "radial-gradient(circle, rgba(91,141,239,0.12) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(40px)", pointerEvents: "none" }} />

          <div style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px)",
            padding: "clamp(32px, 5vw, 50px) clamp(24px, 5vw, 44px)",
            borderRadius: "24px",
            color: "white",
            width: "100%",
            maxWidth: "400px",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 40px 80px rgba(0,0,0,0.5)"
          }}>
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
              <div style={{ width: "52px", height: "52px", background: "linear-gradient(135deg, #7C6EF8, #5B8DEF)", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "22px" }}>💬</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(22px, 4vw, 26px)", fontWeight: "600", color: "white", letterSpacing: "-0.5px" }}>Office Chat</h2>
              <p style={{ fontFamily: "'DM Sans', sans-serif", color: "rgba(255,255,255,0.45)", fontSize: "14px", marginTop: "6px" }}>Sign in to continue</p>
            </div>

            <input className="login-input" placeholder="Username" onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && inputRef.current?.focus()} autoCapitalize="none" autoCorrect="off" />
            <input ref={inputRef} className="login-input" type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />

            {loginError && (
              <div style={{ marginTop: "10px", color: "#ff6b6b", fontSize: "13px", fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>{loginError}</div>
            )}

            <button className="login-btn" onClick={login}>Sign In →</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
        body { font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(124,110,248,0.3); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(124,110,248,0.5); }
        .msg-bubble { transition: transform 0.1s; }
        .msg-bubble:hover { transform: scale(1.005); }
        .sidebar-user { transition: all 0.15s; }
        .sidebar-user:hover { background: rgba(255,255,255,0.06) !important; }
        .icon-btn { transition: all 0.15s; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .icon-btn:hover { opacity: 0.7; transform: scale(1.1); }
        .icon-btn:active { transform: scale(0.9); opacity: 0.7; }
        .send-btn { transition: all 0.2s; -webkit-tap-highlight-color: transparent; }
        .send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(124,110,248,0.4); }
        .send-btn:active:not(:disabled) { transform: translateY(0); opacity: 0.85; }
        .typing-dot { animation: bounce 1.2s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
        .action-btn { transition: all 0.15s; font-family: 'DM Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
        .action-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .action-btn:active { transform: translateY(0); opacity: 0.75; }
        .msg-input { font-family: 'DM Sans', sans-serif; transition: border-color 0.2s; -webkit-appearance: none; }
        .msg-input:focus { outline: none; }
        /* Sidebar overlay for mobile */
        .sidebar-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 40;
          backdrop-filter: blur(2px);
        }
        .sidebar-drawer {
          position: fixed;
          top: 0;
          left: 0;
          height: 100%;
          width: 260px;
          background: #161620;
          border-right: 1px solid rgba(255,255,255,0.06);
          z-index: 50;
          display: flex;
          flex-direction: column;
          transform: translateX(-100%);
          transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
          will-change: transform;
        }
        .sidebar-drawer.open {
          transform: translateX(0);
          box-shadow: 8px 0 40px rgba(0,0,0,0.5);
        }
        /* Desktop: sidebar is always visible */
        @media (min-width: 640px) {
          .sidebar-overlay { display: none !important; }
          .sidebar-drawer {
            position: relative !important;
            transform: none !important;
            width: 240px !important;
            flex-shrink: 0;
            box-shadow: none !important;
            transition: none !important;
          }
          .mobile-header-menu { display: none !important; }
        }
        /* Mobile: overlay + drawer behaviour */
        @media (max-width: 639px) {
          .sidebar-overlay.open { display: block; }
          .mobile-header-menu { display: flex !important; }
          /* Make message bubbles wider on mobile */
          .msg-max-width { max-width: 78% !important; }
          /* Emoji picker sizing */
          .emoji-picker-react { width: 100% !important; min-width: unset !important; }
        }
      `}</style>

      <div style={{ display: "flex", height: "100vh", height: "100dvh", background: "#0f0f13", overflow: "hidden", position: "relative" }}>

        {/* Mobile overlay */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* SIDEBAR / DRAWER */}
        <div className={`sidebar-drawer ${sidebarOpen ? "open" : ""}`}>
          {/* Logo */}
          <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #7C6EF8, #5B8DEF)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: 0 }}>💬</div>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", color: "white", fontWeight: "700", fontSize: "15px", letterSpacing: "-0.3px" }}>OfficeTalk</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px" }}>#{activeUsers.length} online</div>
              </div>
            </div>
            {/* Close button - mobile only */}
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.5)", borderRadius: "8px", width: "30px", height: "30px", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              className="mobile-header-menu"
            >✕</button>
          </div>

          {/* Members */}
          <div style={{ padding: "14px 10px 8px", flex: 1, overflowY: "auto" }}>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px", fontWeight: "600", letterSpacing: "1.5px", textTransform: "uppercase", padding: "0 8px", marginBottom: "8px" }}>Members</div>
            {Object.keys(users).map((u) => (
              <div key={u} className="sidebar-user" style={{ padding: "8px 10px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px", background: u === user ? "rgba(124,110,248,0.15)" : "transparent", border: u === user ? "1px solid rgba(124,110,248,0.2)" : "1px solid transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: avatarColors[u] || "#7C6EF8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", color: "#0f0f13" }}>
                      {getInitials(u)}
                    </div>
                    {activeUsers.includes(u) && (
                      <div style={{ position: "absolute", bottom: "-1px", right: "-1px", width: "8px", height: "8px", background: "#4ade80", borderRadius: "50%", border: "1.5px solid #161620" }} />
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: u === user ? "#a78bfa" : "rgba(255,255,255,0.75)", fontSize: "13px", fontWeight: u === user ? "600" : "400", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u}</div>
                    {mutedStatus[u] && <div style={{ color: "#ff6b6b", fontSize: "10px" }}>muted</div>}
                  </div>
                </div>
                {user === "LG" && u !== "LG" && (
                  <button className="action-btn" onClick={() => toggleMute(u)} style={{ background: mutedStatus[u] ? "rgba(255,107,107,0.15)" : "rgba(74,222,128,0.12)", border: `1px solid ${mutedStatus[u] ? "rgba(255,107,107,0.3)" : "rgba(74,222,128,0.25)"}`, borderRadius: "6px", color: mutedStatus[u] ? "#ff6b6b" : "#4ade80", fontSize: "10px", padding: "3px 7px", cursor: "pointer", fontWeight: "600", flexShrink: 0 }}>
                    {mutedStatus[u] ? "Unmute" : "Mute"}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div style={{ padding: "8px 18px", display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                {[0,1,2].map(i => <div key={i} className="typing-dot" style={{ width: "5px", height: "5px", background: "#7C6EF8", borderRadius: "50%", animationDelay: `${i * 0.2}s` }} />)}
              </div>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>{typingUsers.join(", ")} typing</span>
            </div>
          )}

          {/* Bottom actions */}
          <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "8px" }}>
            {user === "LG" && (
              <>
                <button className="action-btn" onClick={triggerEmergency} style={{ padding: "9px", background: "rgba(255,153,0,0.12)", border: "1px solid rgba(255,153,0,0.25)", color: "#ffa500", borderRadius: "10px", cursor: "pointer", fontSize: "12px", fontWeight: "600", width: "100%" }}>
                  🚨 Emergency Mode
                </button>
                <button className="action-btn" onClick={clearAllMessages} style={{ padding: "9px", background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.2)", color: "#ff6b6b", borderRadius: "10px", cursor: "pointer", fontSize: "12px", fontWeight: "600", width: "100%" }}>
                  🗑 Clear Messages
                </button>
              </>
            )}
            <button className="action-btn" onClick={panicMode} style={{ padding: "9px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.15)", color: "rgba(255,107,107,0.8)", borderRadius: "10px", cursor: "pointer", fontSize: "12px", fontWeight: "600", width: "100%" }}>
              👔 Boss Mode
            </button>
            <button className="action-btn" onClick={logout} style={{ padding: "9px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", borderRadius: "10px", cursor: "pointer", fontSize: "12px", fontWeight: "500", width: "100%" }}>
              Sign out
            </button>
          </div>
        </div>

        {/* MAIN CHAT */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#12121a", overflow: "hidden", minWidth: 0 }}>

          {/* Header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(22,22,32,0.95)", backdropFilter: "blur(10px)", flexShrink: 0, gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Hamburger - mobile only */}
              <button
                className="mobile-header-menu icon-btn"
                onClick={() => setSidebarOpen(true)}
                style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.6)", borderRadius: "8px", width: "34px", height: "34px", cursor: "pointer", fontSize: "16px", display: "none", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >☰</button>
              <div style={{ width: "8px", height: "8px", background: "#4ade80", borderRadius: "50%", boxShadow: "0 0 8px rgba(74,222,128,0.5)", flexShrink: 0 }} />
              <span style={{ fontFamily: "'Syne', sans-serif", color: "white", fontWeight: "700", fontSize: "15px", letterSpacing: "-0.3px", whiteSpace: "nowrap" }}># general</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: avatarColors[user] || "#7C6EF8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", color: "#0f0f13", flexShrink: 0 }}>
                {getInitials(user)}
              </div>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: "500", whiteSpace: "nowrap" }}>{user}</span>
            </div>
          </div>

          {/* Messages area */}
          <div ref={messagesRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px", position: "relative", WebkitOverflowScrolling: "touch" }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", marginTop: "60px" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>💬</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", marginBottom: "6px" }}>No messages yet</div>
                <div style={{ fontSize: "13px" }}>Be the first to say something!</div>
              </div>
            )}

            {messages.map((m, idx) => {
              const isMe = m.user === user;
              const replyMessage = m.replyTo ? messages.find((msg) => msg.id === m.replyTo) : null;
              const prevMsg = messages[idx - 1];
              const sameUserAsPrev = prevMsg && prevMsg.user === m.user;
              const showAvatar = !isMe && !sameUserAsPrev;

              return (
                <div key={m.id} className="msg-bubble" onMouseEnter={() => setHoveredMsg(m.id)} onMouseLeave={() => setHoveredMsg(null)} onTouchStart={() => setHoveredMsg(m.id)} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", alignItems: "flex-end", gap: "6px", marginTop: sameUserAsPrev ? "2px" : "10px" }}>
                  {!isMe && (
                    <div style={{ width: "28px", flexShrink: 0 }}>
                      {showAvatar && (
                        <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: avatarColors[m.user] || "#7C6EF8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", color: "#0f0f13" }}>
                          {getInitials(m.user)}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="msg-max-width" style={{ maxWidth: "55%", position: "relative", minWidth: 0 }}>
                    {showAvatar && !isMe && (
                      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", fontWeight: "600", marginBottom: "4px", paddingLeft: "2px", letterSpacing: "0.3px" }}>{m.user}</div>
                    )}

                    {replyMessage && (
                      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "5px 10px", marginBottom: "4px", borderLeft: "3px solid #7C6EF8", fontSize: "12px", color: "rgba(255,255,255,0.45)", wordBreak: "break-word" }}>
                        <span style={{ color: "#a78bfa", fontWeight: "600" }}>{replyMessage.user}: </span>
                        {replyMessage.text.length > 60 ? replyMessage.text.slice(0, 60) + "..." : replyMessage.text}
                      </div>
                    )}

                    <div
                      onClick={() => setReplyTo(m.id)}
                      style={{ background: isMe ? "linear-gradient(135deg, #7C6EF8, #5B8DEF)" : "rgba(255,255,255,0.07)", color: "white", padding: isGifMessage(m) ? "4px" : "10px 13px", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", fontSize: "14px", lineHeight: "1.5", cursor: "pointer", border: isMe ? "none" : "1px solid rgba(255,255,255,0.08)", wordBreak: "break-word", overflowWrap: "break-word", boxShadow: isMe ? "0 4px 15px rgba(124,110,248,0.25)" : "0 2px 8px rgba(0,0,0,0.2)", WebkitTapHighlightColor: "transparent" }}
                    >
                      {isGifMessage(m) ? (
                        <img src={m.text} alt="GIF" style={{ maxWidth: "200px", maxHeight: "160px", borderRadius: "12px", display: "block", objectFit: "cover" }} />
                      ) : m.text}

                      <div style={{ fontSize: "10px", opacity: 0.5, marginTop: "4px", textAlign: isMe ? "right" : "left" }}>
                        {m.time?.toDate?.() ? m.time.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "•••"}
                      </div>
                    </div>

                    {/* Hover/touch actions */}
                    {hoveredMsg === m.id && (
                      <div style={{ position: "absolute", top: "-30px", [isMe ? "left" : "right"]: "0", display: "flex", gap: "4px", background: "rgba(22,22,32,0.97)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "4px 8px", zIndex: 10, boxShadow: "0 4px 15px rgba(0,0,0,0.4)" }}>
                        <span className="icon-btn" onClick={() => setReplyTo(m.id)} style={{ fontSize: "14px", padding: "2px 4px" }} title="Reply">↩</span>
                        {user === "LG" && (
                          <span className="icon-btn" onClick={() => deleteMessage(m.id)} style={{ fontSize: "14px", padding: "2px 4px", color: "#ff6b6b" }} title="Delete">🗑</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />

            {newMessageAlert && (
              <button onClick={() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); setNewMessageAlert(false); }} style={{ position: "sticky", bottom: "10px", left: "50%", transform: "translateX(-50%)", display: "block", margin: "0 auto", background: "linear-gradient(135deg, #7C6EF8, #5B8DEF)", color: "white", border: "none", borderRadius: "20px", padding: "8px 18px", cursor: "pointer", fontSize: "12px", fontWeight: "600", boxShadow: "0 4px 15px rgba(124,110,248,0.4)", zIndex: 10, WebkitTapHighlightColor: "transparent" }}>
                ↓ New messages
              </button>
            )}
          </div>

          {/* Input area */}
          <div style={{ padding: "8px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "#12121a", flexShrink: 0, paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>

            {showEmoji && (
              <div style={{ marginBottom: "8px", maxHeight: "320px", overflow: "hidden" }}>
                <EmojiPicker
                  theme="dark"
                  onEmojiClick={(emoji) => { setMsg(msg + emoji.emoji); setShowEmoji(false); }}
                  height={300}
                  width="100%"
                  style={{ width: "100%" }}
                />
              </div>
            )}

            {showGif && (
              <div style={{ marginBottom: "8px", background: "rgba(22,22,32,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "12px", backdropFilter: "blur(20px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <input
                    autoFocus
                    placeholder="Search GIFs..."
                    value={gifQuery}
                    onChange={(e) => searchGifs(e.target.value)}
                    style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "9px 12px", color: "white", fontSize: "14px", outline: "none", fontFamily: "'DM Sans', sans-serif", WebkitAppearance: "none" }}
                  />
                  <span onClick={() => { setShowGif(false); setGifQuery(""); setGifResults([]); }} className="icon-btn" style={{ color: "rgba(255,255,255,0.4)", fontSize: "18px", padding: "4px", lineHeight: 1 }}>✕</span>
                </div>
                {gifLoading && <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px", padding: "16px" }}>Searching...</div>}
                {!gifLoading && gifResults.length === 0 && gifQuery && (
                  <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: "13px", padding: "16px" }}>No GIFs found</div>
                )}
                {!gifLoading && gifResults.length === 0 && !gifQuery && (
                  <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "13px", padding: "16px" }}>Type to search Tenor GIFs 🎞</div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", maxHeight: "200px", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                  {gifResults.map((gif) => {
                    const url = gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url;
                    if (!url) return null;
                    return (
                      <img
                        key={gif.id}
                        src={url}
                        alt={gif.content_description}
                        onClick={() => sendGif(url)}
                        style={{ width: "100%", height: "75px", objectFit: "cover", borderRadius: "8px", cursor: "pointer", border: "2px solid transparent", transition: "all 0.15s" }}
                        onMouseEnter={(e) => { e.target.style.border = "2px solid #7C6EF8"; e.target.style.transform = "scale(1.03)"; }}
                        onMouseLeave={(e) => { e.target.style.border = "2px solid transparent"; e.target.style.transform = "scale(1)"; }}
                      />
                    );
                  })}
                </div>
                <div style={{ textAlign: "center", marginTop: "8px", opacity: 0.3 }}>
                  <img src="https://www.gstatic.com/tenor/web/attribution/PB_tenor_logo_blue_horizontal.png" alt="Powered by Tenor" style={{ height: "12px" }} />
                </div>
              </div>
            )}

            {replyTo && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(124,110,248,0.1)", border: "1px solid rgba(124,110,248,0.2)", borderRadius: "10px", padding: "7px 12px", marginBottom: "8px", gap: "8px" }}>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                  <span style={{ color: "#a78bfa", flexShrink: 0 }}>↩ Replying to:</span>
                  <span style={{ color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{messages.find((m) => m.id === replyTo)?.text?.slice(0, 40) || "..."}</span>
                </div>
                <span onClick={() => setReplyTo(null)} className="icon-btn" style={{ color: "#ff6b6b", fontSize: "16px", flexShrink: 0 }}>✕</span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "5px 5px 5px 12px" }}>
              <button onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }} className="icon-btn" style={{ background: "none", border: "none", fontSize: "20px", flexShrink: 0, padding: "4px", lineHeight: 1 }}>
                😀
              </button>
              <button onClick={() => { setShowGif(!showGif); setShowEmoji(false); }} className="icon-btn" style={{ background: showGif ? "rgba(124,110,248,0.2)" : "none", border: showGif ? "1px solid rgba(124,110,248,0.3)" : "1px solid transparent", borderRadius: "8px", fontSize: "12px", flexShrink: 0, padding: "5px 8px", color: showGif ? "#a78bfa" : "rgba(255,255,255,0.45)", fontWeight: "700", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", lineHeight: 1 }}>
                GIF
              </button>

              <input
                className="msg-input"
                value={msg}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                placeholder={mutedStatus[user] ? "You are muted..." : "Message #general"}
                disabled={mutedStatus[user]}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontSize: "15px", padding: "7px 0", minWidth: 0 }}
              />

              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={mutedStatus[user] || !msg.trim()}
                style={{ padding: "10px 14px", background: msg.trim() && !mutedStatus[user] ? "linear-gradient(135deg, #7C6EF8, #5B8DEF)" : "rgba(255,255,255,0.06)", color: msg.trim() && !mutedStatus[user] ? "white" : "rgba(255,255,255,0.25)", border: "none", borderRadius: "10px", cursor: msg.trim() && !mutedStatus[user] ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: "600", flexShrink: 0, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}
              >
                Send ↗
              </button>
            </div>

            <div style={{ textAlign: "center", marginTop: "6px", color: "rgba(255,255,255,0.12)", fontSize: "10px" }}>
              Enter to send • Tap any message to reply
            </div>
          </div>
        </div>
      </div>
    </>
  );
}