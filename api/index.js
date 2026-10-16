<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Farman Kisan Hub | Executive AI Platform</title>

<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">

<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          hubDark: '#080d1a',
          hubCard: 'rgba(15, 23, 42, 0.75)',
          emeraldGlow: '#059669',
          goldAccent: '#fbbf24',
        },
        fontFamily: {
          sans: ['"Plus Jakarta Sans"', 'sans-serif'],
          urdu: ['"Noto Nastaliq Urdu"', 'serif'],
        }
      }
    }
  }
</script>

<style>
  body {
    background-color: #050914;
    background-image: 
      radial-gradient(at 0% 0%, rgba(5, 150, 105, 0.12) 0px, transparent 50%),
      radial-gradient(at 100% 100%, rgba(217, 119, 6, 0.08) 0px, transparent 50%);
  }
  .glass-card {
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .glass-nav {
    background: rgba(8, 13, 26, 0.85);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .glow-border:focus-within {
    border-color: rgba(16, 185, 129, 0.6);
    box-shadow: 0 0 30px rgba(16, 185, 129, 0.15);
  }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: rgba(5, 9, 20, 0.5); }
  ::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.3); border-radius: 4px; }
</style>
</head>
<body class="text-slate-100 font-sans min-h-screen flex flex-col justify-between selection:bg-emerald-500 selection:text-white">

  <!-- Sidebar Overlay -->
  <div id="sidebarOverlay" class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm hidden md:hidden"></div>

  <!-- Sidebar -->
  <aside id="sidebar" class="fixed inset-y-0 left-0 z-50 w-72 glass-nav transform -translate-x-full md:translate-x-0 transition-transform duration-300 flex flex-col border-r border-white/10">
    <div class="p-4 flex items-center justify-between border-b border-white/10">
      <button id="newChatBtn" class="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all">
        <i class="fa-solid fa-plus"></i> New Chat
      </button>
      <button id="closeSidebar" class="md:hidden ml-2 text-slate-400 hover:text-white p-2">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-3 space-y-2" id="chatHistoryList">
      <div class="text-[11px] text-slate-500 uppercase tracking-wider px-2 py-1">Recent Chats</div>
    </div>
    <div class="p-3 border-t border-white/10 text-xs text-slate-500 text-center">
      Farman Kisan Hub v2.0
    </div>
  </aside>

  <!-- Main Wrapper -->
  <div class="flex-1 flex flex-col md:pl-72 justify-between min-h-screen">

    <!-- Header -->
    <header class="glass-nav sticky top-0 z-30 px-4 sm:px-6 py-3.5 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <button id="toggleSidebar" class="md:hidden text-slate-300 hover:text-white text-lg p-1">
          <i class="fa-solid fa-bars"></i>
        </button>
        <div class="relative w-9 h-9 flex items-center justify-center">
          <svg class="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" stroke="url(#logoGlow)" stroke-width="3" class="animate-pulse" />
            <path d="M50 20 L62 42 L85 38 L70 58 L82 80 L50 68 L18 80 L30 58 L15 38 L38 42 Z" fill="url(#crownGrad)" />
            <path d="M50 35 C55 45, 65 50, 65 65 C65 73, 58 80, 50 80 C42 80, 35 73, 35 65 C35 50, 45 45, 50 35 Z" fill="url(#leafGrad)" />
            <defs>
              <linearGradient id="logoGlow" x1="0" y1="0" x2="100" y2="100">
                <stop offset="0%" stop-color="#10b981" />
                <stop offset="100%" stop-color="#f59e0b" />
              </linearGradient>
              <linearGradient id="crownGrad" x1="0" y1="0" x2="100" y2="100">
                <stop offset="0%" stop-color="#fbbf24" />
                <stop offset="100%" stop-color="#d97706" />
              </linearGradient>
              <linearGradient id="leafGrad" x1="0" y1="0" x2="100" y2="100">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#059669" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div>
          <div class="flex items-center gap-2">
            <h1 class="font-bold text-sm sm:text-base tracking-wide text-white">FARMAN KISAN HUB</h1>
            <span class="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              FAST AI
            </span>
          </div>
          <p class="text-[10px] text-slate-400">Multilingual Agriculture Intelligence</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button id="liveCallBtn" class="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all">
          <i class="fa-solid fa-phone-volume text-[11px] animate-bounce"></i> <span>Live Call</span>
        </button>
        <div id="userSection" class="flex items-center gap-2">
          <button id="authBtn" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all">
            Login
          </button>
        </div>
      </div>
    </header>

    <!-- Call Modal -->
    <div id="callModal" class="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 hidden">
      <div class="glass-card max-w-sm w-full p-8 rounded-3xl text-center relative border border-emerald-500/30 shadow-2xl flex flex-col items-center">
        <button id="closeCall" class="absolute top-4 right-4 text-slate-400 hover:text-white">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
        
        <div id="callOrb" class="w-28 h-28 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center my-6 relative animate-pulse transition-all duration-300">
          <i class="fa-solid fa-waveform text-4xl text-emerald-400"></i>
          <div class="absolute inset-0 rounded-full border border-emerald-400 animate-ping opacity-25"></div>
        </div>

        <h3 class="text-lg font-bold text-white mb-1">Kisan Hub AI Call</h3>
        <p id="callStatus" class="text-xs text-emerald-400 mb-8 font-medium">Listening...</p>

        <button id="endCallBtn" class="bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-8 rounded-full text-sm transition-all shadow-lg shadow-red-600/30 flex items-center gap-2">
          <i class="fa-solid fa-phone-slash"></i> End Call
        </button>
      </div>
    </div>

    <!-- Auth Modal -->
    <div id="authModal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 hidden">
      <div class="glass-card max-w-md w-full p-6 rounded-2xl relative border border-white/10 shadow-2xl">
        <button id="closeAuth" class="absolute top-4 right-4 text-slate-400 hover:text-white">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>

        <h2 id="authTitle" class="text-xl font-bold text-white mb-2">Welcome Back</h2>
        <p id="authSub" class="text-xs text-slate-400 mb-6">Login or create an account</p>

        <form id="authForm" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <input id="authEmail" type="email" placeholder="kisan@farm.com" required class="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <input id="authPassword" type="password" placeholder="••••••••" required class="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
          </div>

          <button type="submit" id="authSubmitBtn" class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-lg shadow-emerald-600/30">
            Login
          </button>
        </form>

        <p class="text-center text-xs text-slate-400 mt-4">
          <span id="toggleAuthText">Don't have an account?</span>
          <button id="toggleAuthBtn" class="text-emerald-400 font-semibold underline ml-1">Sign Up</button>
        </p>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="max-w-3xl w-full mx-auto px-4 pt-4">
      <div class="flex bg-slate-950/60 p-1 rounded-xl border border-white/10">
        <button class="tab active flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg" data-tab="chat">
          <i class="fa-solid fa-comments text-xs"></i> <span>Ask AI Assistant</span>
        </button>
        <button class="tab flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all flex items-center justify-center gap-2" data-tab="advice">
          <i class="fa-solid fa-wheat-awn text-xs"></i> <span>Crop Consultation Form</span>
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <main class="flex-1 max-w-3xl w-full mx-auto p-4 flex flex-col justify-between w-full">
      <section id="chat" class="panel active flex-1 flex flex-col justify-between h-full">
        <div id="messages" class="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[50vh] max-h-[58vh] py-2"></div>

        <!-- Suggestion Chips -->
        <div id="chips" class="flex flex-wrap gap-2 my-3 justify-center">
          <button class="chip text-xs bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-slate-300 px-3 py-2 rounded-xl transition-all cursor-pointer">
            <span>Best crop to plant this season?</span>
          </button>
          <button class="chip text-xs bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-slate-300 px-3 py-2 rounded-xl transition-all cursor-pointer">
            <span>Short duration crop options</span>
          </button>
          <button class="chip text-xs bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-slate-300 px-3 py-2 rounded-xl transition-all cursor-pointer">
            <span>Wheat leaf yellowing treatment</span>
          </button>
        </div>

        <!-- Input Bar -->
        <div class="glass-card p-2 rounded-2xl border border-white/10 glow-border transition-all flex items-center gap-2 shadow-2xl">
          <button id="micBtn" title="Speak to AI" class="text-slate-400 hover:text-emerald-400 p-2.5 rounded-xl transition-all">
            <i class="fa-solid fa-microphone text-sm"></i>
          </button>
          <input id="q" type="text" placeholder="Ask anything in English, Urdu, or Roman Urdu..." autocomplete="off" class="flex-1 bg-transparent border-none focus:outline-none text-sm text-slate-100 placeholder-slate-500 px-2">
          <button id="send" class="primary bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5">
            <span>Send</span> <i class="fa-solid fa-paper-plane text-xs"></i>
          </button>
        </div>
      </section>

      <section id="advice" class="panel hidden">
        <div class="glass-card p-6 rounded-2xl border border-white/10 shadow-2xl">
          <h2 class="text-base font-bold text-white mb-4">Crop Consultation Form</h2>
          <form id="adviceForm" class="space-y-4">
            <input name="location" placeholder="Region / District (e.g. Multan)" required class="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none">
            <textarea name="notes" rows="3" placeholder="Describe issue..." class="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none"></textarea>
            <button class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-3 rounded-xl text-sm" type="submit" id="adviceBtn">Get Consultation</button>
          </form>
          <div id="result" class="mt-4 p-4 rounded-xl glass-card text-sm text-slate-200 hidden"></div>
        </div>
      </section>
    </main>

    <footer class="text-center py-3 text-xs text-slate-500 border-t border-white/5 bg-slate-950/50">
      Farman Kisan Hub • Powered by Gemini AI
    </footer>
  </div>

  <!-- Firebase Modular Scripts -->
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getAuth, setPersistence, browserLocalPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
    import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

    const firebaseConfig = {
      apiKey: "AIzaSyCu0rYEobmgK0cCmZLroIWguiPqyPhOAeI",
      authDomain: "farman-5f2fe.firebaseapp.com",
      projectId: "farman-5f2fe",
      storageBucket: "farman-5f2fe.firebasestorage.app",
      messagingSenderId: "392223096053",
      appId: "1:392223096053:web:9c2d61ad6a0d9e2acb59bc",
      measurementId: "G-TF8KM4G88G"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    setPersistence(auth, browserLocalPersistence).catch(console.error);

    let currentUser = null;
    let isSignUp = false;

    const authModal = document.getElementById("authModal");
    const authBtn = document.getElementById("authBtn");
    const closeAuth = document.getElementById("closeAuth");
    const authForm = document.getElementById("authForm");
    const toggleAuthBtn = document.getElementById("toggleAuthBtn");
    const authTitle = document.getElementById("authTitle");
    const authSubmitBtn = document.getElementById("authSubmitBtn");
    const toggleAuthText = document.getElementById("toggleAuthText");
    const userSection = document.getElementById("userSection");

    document.addEventListener("click", (e) => {
      if (e.target.closest("#authBtn")) authModal.classList.remove("hidden");
    });
    if (authBtn) authBtn.addEventListener("click", () => authModal.classList.remove("hidden"));
    closeAuth.addEventListener("click", () => authModal.classList.add("hidden"));

    toggleAuthBtn.addEventListener("click", () => {
      isSignUp = !isSignUp;
      authTitle.textContent = isSignUp ? "Create Account" : "Welcome Back";
      authSubmitBtn.textContent = isSignUp ? "Sign Up" : "Login";
      toggleAuthText.textContent = isSignUp ? "Already have an account?" : "Don't have an account?";
      toggleAuthBtn.textContent = isSignUp ? "Login" : "Sign Up";
    });

    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("authEmail").value;
      const pass = document.getElementById("authPassword").value;
      try {
        if (isSignUp) await createUserWithEmailAndPassword(auth, email, pass);
        else await signInWithEmailAndPassword(auth, email, pass);
        authModal.classList.add("hidden");
      } catch (err) { alert(err.message); }
    });

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      if (user) {
        userSection.innerHTML = `
          <span class="text-xs text-emerald-400 font-medium">${user.email.split('@')[0]}</span>
          <button id="logoutBtn" class="bg-red-500/20 hover:bg-red-500/40 text-red-300 text-xs px-2.5 py-1 rounded-lg">Logout</button>
        `;
        document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));
        loadUserHistory(user.uid);
      } else {
        userSection.innerHTML = `<button id="authBtn" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-semibold">Login</button>`;
      }
    });

    async function saveChatToCloud(userMsg, botReply) {
      if (!currentUser) return;
      try {
        await addDoc(collection(db, "chats"), {
          userId: currentUser.uid,
          userMsg,
          botReply,
          createdAt: new Date()
        });
      } catch (e) { console.error("Cloud Error:", e); }
    }

    async function loadUserHistory(uid) {
      try {
        document.getElementById("messages").innerHTML = "";
        const historyList = document.getElementById("chatHistoryList");
        historyList.innerHTML = `<div class="text-[11px] text-slate-500 uppercase tracking-wider px-2 py-1">Recent Chats</div>`;
        
        const q = query(collection(db, "chats"), where("userId", "==", uid));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          addBubble(data.userMsg, "me");
          addBubble(data.botReply, "bot");

          const item = document.createElement("button");
          item.className = "w-full text-left text-xs text-slate-300 hover:bg-white/5 p-2 rounded-xl truncate transition-all flex items-center gap-2";
          item.innerHTML = `<i class="fa-solid fa-message text-[10px] text-emerald-400"></i> <span class="truncate">${data.userMsg}</span>`;
          item.addEventListener("click", () => {
            addBubble(data.userMsg, "me");
            addBubble(data.botReply, "bot");
          });
          historyList.appendChild(item);
        });
      } catch (e) { console.error("History error:", e); }
    }

    window.saveChatToCloud = saveChatToCloud;
  </script>

  <script>
    // Tab controls
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((btn) => btn.classList.remove("bg-gradient-to-r", "from-emerald-600", "to-teal-600", "text-white"));
        t.classList.add("bg-gradient-to-r", "from-emerald-600", "to-teal-600", "text-white");
        document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
        document.getElementById(t.dataset.tab).classList.remove("hidden");
      });
    });

    // Sidebar
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    document.getElementById("toggleSidebar").addEventListener("click", () => {
      sidebar.classList.remove("-translate-x-full");
      sidebarOverlay.classList.remove("hidden");
    });
    sidebarOverlay.addEventListener("click", () => {
      sidebar.classList.add("-translate-x-full");
      sidebarOverlay.classList.add("hidden");
    });
    document.getElementById("closeSidebar").addEventListener("click", () => {
      sidebar.classList.add("-translate-x-full");
      sidebarOverlay.classList.add("hidden");
    });

    document.getElementById("newChatBtn").addEventListener("click", () => {
      document.getElementById("messages").innerHTML = "";
      conversationHistory = [];
      if(window.innerWidth < 768) {
        sidebar.classList.add("-translate-x-full");
        sidebarOverlay.classList.add("hidden");
      }
    });

    const box = document.getElementById("messages");
    const input = document.getElementById("q");
    const sendBtn = document.getElementById("send");

    let conversationHistory = [];

    function addBubble(text, cls) {
      const isUser = cls.includes("me");
      const d = document.createElement("div");
      d.className = `flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`;
      const isUrdu = /[\u0600-\u06FF]/.test(text);

      d.innerHTML = `
        <div class="w-8 h-8 rounded-xl ${isUser ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'} flex items-center justify-center shrink-0 text-xs">
          <i class="fa-solid ${isUser ? 'fa-user' : 'fa-robot'}"></i>
        </div>
        <div class="glass-card p-3.5 rounded-2xl max-w-[85%] text-sm text-slate-200 ${isUrdu ? 'font-urdu text-right' : ''}" ${isUrdu ? 'dir="rtl"' : ''}>
          ${text}
        </div>
      `;
      box.appendChild(d);
      box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
      return d;
    }

    async function send(text) {
      const queryText = (text || input.value).trim();
      if (!queryText) return;
      
      input.value = "";
      conversationHistory.push({ role: "user", content: queryText });

      addBubble(queryText, "me");
      const wait = addBubble("Thinking...", "bot typing");

      sendBtn.disabled = true;
      sendBtn.classList.add("opacity-50");

      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: conversationHistory }),
        });
        
        const data = await r.json();
        wait.remove();

        const reply = data.reply || "No response received.";
        conversationHistory.push({ role: "assistant", content: reply });

        addBubble(reply, "bot");

        if (window.saveChatToCloud) {
          window.saveChatToCloud(queryText, reply);
        }
      } catch (e) {
        wait.remove();
        addBubble("Server connection error. Please try again.", "bot");
      } finally {
        sendBtn.disabled = false;
        sendBtn.classList.remove("opacity-50");
      }
    }

    sendBtn.addEventListener("click", () => send());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    
    document.querySelectorAll(".chip").forEach((c) => {
      c.addEventListener("click", () => {
        const chipText = c.querySelector("span") ? c.querySelector("span").textContent : c.textContent;
        send(chipText);
      });
    });

    // Mic input
    const micBtn = document.getElementById("micBtn");
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'ur-PK';
      recognition.continuous = false;

      micBtn.addEventListener("click", () => {
        recognition.start();
        micBtn.classList.add("text-emerald-400", "animate-pulse");
      });

      recognition.onresult = (event) => {
        const speechToText = event.results[0][0].transcript;
        input.value = speechToText;
        micBtn.classList.remove("text-emerald-400", "animate-pulse");
        send(speechToText);
      };

      recognition.onerror = () => micBtn.classList.remove("text-emerald-400", "animate-pulse");
    } else {
      micBtn.style.display = 'none';
    }

    // High Speed Voice Call Engine
    const callModal = document.getElementById("callModal");
    const liveCallBtn = document.getElementById("liveCallBtn");
    const closeCall = document.getElementById("closeCall");
    const endCallBtn = document.getElementById("endCallBtn");
    const callStatus = document.getElementById("callStatus");
    const callOrb = document.getElementById("callOrb");

    let callRecognition = null;
    let isCallActive = false;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }

    liveCallBtn.addEventListener("click", () => {
      callModal.classList.remove("hidden");
      isCallActive = true;
      startRealtimeCallSession();
    });

    function stopCall() {
      isCallActive = false;
      callModal.classList.add("hidden");
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (callRecognition) callRecognition.stop();
    }

    closeCall.addEventListener("click", stopCall);
    endCallBtn.addEventListener("click", stopCall);

    function speakAudioDirectly(text, onComplete) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        const isUrduScript = /[\u0600-\u06FF]/.test(text);
        utterance.lang = isUrduScript ? 'ur-PK' : 'en-US';
        utterance.rate = 1.1;

        utterance.onstart = () => {
          callStatus.textContent = "AI Speaking...";
          callOrb.classList.add("scale-110", "border-amber-400");
        };

        utterance.onend = () => {
          callOrb.classList.remove("scale-110", "border-amber-400");
          if (onComplete && isCallActive) onComplete();
        };

        utterance.onerror = () => {
          callOrb.classList.remove("scale-110", "border-amber-400");
          if (onComplete && isCallActive) onComplete();
        };

        window.speechSynthesis.speak(utterance);
      } else {
        if (onComplete && isCallActive) onComplete();
      }
    }

    function startRealtimeCallSession() {
      if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        callStatus.textContent = "Voice Call not supported in this browser.";
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      callRecognition = new SpeechRecognition();
      callRecognition.lang = 'ur-PK';
      callRecognition.continuous = false;
      callRecognition.interimResults = false;

      callStatus.textContent = "Listening...";
      try { callRecognition.start(); } catch(e){}

      callRecognition.onresult = async (event) => {
        if (!isCallActive) return;
        const userSpoken = event.results[0][0].transcript;
        callStatus.textContent = "Thinking...";

        try {
          const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              messages: [{ role: "user", content: userSpoken }],
              isCall: true 
            }),
          });
          const data = await r.json();
          const botReply = data.reply || "Ji bolayein, main sun raha hoon.";

          speakAudioDirectly(botReply, () => {
            if (isCallActive) {
              callStatus.textContent = "Listening...";
              try { callRecognition.start(); } catch(e){}
            }
          });

        } catch(e) {
          callStatus.textContent = "Connection error.";
          setTimeout(() => { if(isCallActive) try{ callRecognition.start(); }catch(err){} }, 1000);
        }
      };

      callRecognition.onerror = () => {
        if (isCallActive) {
          setTimeout(() => { try { callRecognition.start(); } catch(e){} }, 500);
        }
      };
    }
  </script>
</body>
</html>
