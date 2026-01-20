const supabaseUrl = "https://styegsfyqtjgiykiuztv.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0eWVnc2Z5cXRqZ2l5a2l1enR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NzIxODEsImV4cCI6MjA4NDQ0ODE4MX0.Or1BE7mVUNyoeI-CCax1DzvjNXCcScayVlh8ZQeAYYs";
const supabaseClient = window.supabase
  ? window.supabase.createClient(supabaseUrl, supabaseKey)
  : null;

const loader = document.querySelector(".loader");

const startExperience = () => {
  if (!loader) {
    return;
  }
  loader.classList.add("fade-out");
  setTimeout(() => loader.remove(), 900);
};

setTimeout(startExperience, 1200);

const authLinks = document.querySelectorAll(".auth-link");
const userMenu = document.querySelector(".user-menu");
const avatarButton = userMenu ? userMenu.querySelector(".avatar-button") : null;
const userDropdown = userMenu ? userMenu.querySelector(".user-dropdown") : null;
const signOutButton = userMenu ? userMenu.querySelector('[data-action="signout"]') : null;

const setAuthUI = (session) => {
  authLinks.forEach((link) => link.classList.toggle("hidden", Boolean(session)));
  if (!userMenu || !avatarButton) {
    return;
  }
  if (session?.user?.email) {
    userMenu.classList.remove("hidden");
    avatarButton.textContent = session.user.email[0].toUpperCase();
  } else {
    userMenu.classList.add("hidden");
  }
};

if (avatarButton && userDropdown) {
  avatarButton.addEventListener("click", (event) => {
    event.stopPropagation();
    userDropdown.classList.toggle("hidden");
  });
  document.addEventListener("click", () => {
    if (!userDropdown.classList.contains("hidden")) {
      userDropdown.classList.add("hidden");
    }
  });
}

if (signOutButton && supabaseClient) {
  signOutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "../signin.html";
  });
}

const getSession = async () => {
  if (!supabaseClient) {
    return null;
  }
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
};

const showMessage = (element, message) => {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.classList.remove("hidden");
};

const clearMessage = (element) => {
  if (!element) {
    return;
  }
  element.textContent = "";
  element.classList.add("hidden");
};

const initDashboard = async (session) => {
  const list = document.getElementById("board-list");
  if (!list || !supabaseClient) {
    return;
  }
  const empty = document.getElementById("board-empty");
  const message = document.getElementById("dashboard-message");
  const createButton = document.getElementById("create-board");
  const nameInput = document.getElementById("board-name");
  const colorInput = document.getElementById("board-color");

  if (createButton) {
    createButton.addEventListener("click", async () => {
      if (!session) {
        showMessage(message, "Sign in to create boards.");
        return;
      }
      const name = nameInput.value.trim();
      if (!name) {
        showMessage(message, "Name your board first.");
        return;
      }
      clearMessage(message);
      const { error: insertError } = await supabaseClient.from("boards").insert({
        user_id: session.user.id,
        name,
        color: colorInput.value,
      });
      if (insertError) {
        showMessage(message, insertError.message);
        return;
      }
      nameInput.value = "";
      window.location.reload();
    });
  }
  if (!session) {
    showMessage(message, "Sign in to view your boards.");
    return;
  }
  clearMessage(message);

  const { data, error } = await supabaseClient
    .from("boards")
    .select("id,name,color,created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    showMessage(message, error.message);
    return;
  }

  list.innerHTML = "";
  if (!data || data.length === 0) {
    if (empty) {
      empty.classList.remove("hidden");
    }
    return;
  }
  if (empty) {
    empty.classList.add("hidden");
  }

  data.forEach((board) => {
    const card = document.createElement("div");
    card.className = "board-card";
    card.innerHTML = `
      <div style="width:36px;height:6px;border-radius:999px;background:${board.color || "#2f6bff"}"></div>
      <h3>${board.name}</h3>
      <span>${new Date(board.created_at).toLocaleDateString()}</span>
    `;
    const openButton = document.createElement("button");
    openButton.className = "ghost-button";
    openButton.textContent = "Open board";
    openButton.addEventListener("click", () => {
      window.location.href = `board.html?id=${board.id}`;
    });
    card.appendChild(openButton);
    list.appendChild(card);
  });

};

const initBoard = async (session) => {
  const boardPlane = document.getElementById("board-plane");
  if (!boardPlane || !supabaseClient) {
    return;
  }
  if (!session) {
    window.location.href = "../signin.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const boardId = params.get("id");
  if (!boardId) {
    window.location.href = "index.html";
    return;
  }

  const { data: board, error } = await supabaseClient
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .single();

  if (error || !board) {
    window.location.href = "index.html";
    return;
  }

  const drawLayer = document.getElementById("draw-layer");
  const ctx = drawLayer.getContext("2d");
  let isDrawing = false;
  let activeTool = "pan";
  let panX = 0;
  let panY = 0;
  let startPan = null;

  const audioFile = document.getElementById("audio-file");
  const audioPlay = document.getElementById("audio-play");
  const audioSeek = document.getElementById("audio-seek");
  const audioVolume = document.getElementById("audio-volume");
  const audioName = document.getElementById("audio-name");
  const currentTimeEl = document.getElementById("current-time");
  const totalTimeEl = document.getElementById("total-time");
  const waveform = document.getElementById("waveform");
  const waveCtx = waveform.getContext("2d");
  const brushSize = document.getElementById("brush-size");
  const brushColor = document.getElementById("brush-color");

  const audio = new Audio();
  audio.preload = "auto";

  const setTool = (tool) => {
    activeTool = tool;
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === tool);
    });
  };

  document.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = btn.dataset.tool;
      if (tool === "image") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.addEventListener("change", () => {
          const file = input.files?.[0];
          if (file) {
            createImageFromFile(file);
          }
        });
        input.click();
        return;
      }
      if (tool === "link") {
        const url = prompt("Paste a URL");
        if (url) {
          createLink(url);
        }
        return;
      }
      if (tool === "text") {
        createNote("New note");
        return;
      }
      setTool(tool);
    });
  });

  const applyPan = () => {
    boardPlane.style.transform = `translate(${panX}px, ${panY}px)`;
  };

  const boardViewport = document.getElementById("board-viewport");
  boardViewport.addEventListener("contextmenu", (event) => event.preventDefault());
  boardViewport.addEventListener("pointerdown", (event) => {
    if (event.button === 2 || activeTool === "pan") {
      startPan = { x: event.clientX - panX, y: event.clientY - panY };
      boardViewport.setPointerCapture(event.pointerId);
    }
  });
  boardViewport.addEventListener("pointermove", (event) => {
    if (!startPan) {
      return;
    }
    panX = event.clientX - startPan.x;
    panY = event.clientY - startPan.y;
    applyPan();
  });
  boardViewport.addEventListener("pointerup", () => {
    startPan = null;
  });

  const drawStart = (event) => {
    if (activeTool !== "draw" && activeTool !== "erase") {
      return;
    }
    isDrawing = true;
    ctx.lineWidth = Number(brushSize.value);
    ctx.lineCap = "round";
    ctx.strokeStyle = brushColor.value;
    ctx.globalCompositeOperation = activeTool === "erase" ? "destination-out" : "source-over";
    ctx.beginPath();
    const rect = drawLayer.getBoundingClientRect();
    ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top);
  };

  const drawMove = (event) => {
    if (!isDrawing) {
      return;
    }
    const rect = drawLayer.getBoundingClientRect();
    ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    ctx.stroke();
  };

  const drawEnd = async () => {
    if (!isDrawing) {
      return;
    }
    isDrawing = false;
    ctx.closePath();
    const dataUrl = drawLayer.toDataURL("image/png");
    await supabaseClient
      .from("boards")
      .update({ drawing_data: dataUrl })
      .eq("id", boardId);
  };

  drawLayer.addEventListener("pointerdown", drawStart);
  drawLayer.addEventListener("pointermove", drawMove);
  drawLayer.addEventListener("pointerup", drawEnd);
  drawLayer.addEventListener("pointerleave", drawEnd);

  if (board.drawing_data) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = board.drawing_data;
  }

  const createItem = async (type, content, meta = {}, position = null) => {
    const viewportRect = boardViewport.getBoundingClientRect();
    const centerX = viewportRect.width / 2 - panX;
    const centerY = viewportRect.height / 2 - panY;
    const { x, y } = position || { x: centerX, y: centerY };
    const { data, error: insertError } = await supabaseClient
      .from("board_items")
      .insert({
        board_id: boardId,
        user_id: session.user.id,
        type,
        content,
        x,
        y,
        meta,
      })
      .select()
      .single();
    if (insertError) {
      return null;
    }
    return data;
  };

  const renderItem = (item) => {
    let element;
    if (item.type === "text") {
      element = document.createElement("div");
      element.className = "note";
      element.contentEditable = "true";
      element.textContent = item.content || "";
      element.addEventListener("blur", async () => {
        await supabaseClient.from("board_items").update({ content: element.textContent }).eq("id", item.id);
      });
    }
    if (item.type === "link") {
      element = document.createElement("div");
      element.className = "link-card";
      element.innerHTML = `<a href="${item.content}" target="_blank" rel="noreferrer">${item.content}</a>`;
    }
    if (item.type === "image") {
      element = document.createElement("img");
      element.className = "image-item";
      element.src = item.content;
    }
    if (!element) {
      return;
    }
    element.style.left = `${item.x}px`;
    element.style.top = `${item.y}px`;
    element.dataset.id = item.id;
    enableDrag(element);
    boardPlane.appendChild(element);
  };

  const enableDrag = (element) => {
    let start = null;
    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      start = { x: event.clientX, y: event.clientY };
      element.setPointerCapture(event.pointerId);
    });
    element.addEventListener("pointermove", (event) => {
      if (!start) {
        return;
      }
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      element.style.left = `${parseFloat(element.style.left) + dx}px`;
      element.style.top = `${parseFloat(element.style.top) + dy}px`;
      start = { x: event.clientX, y: event.clientY };
    });
    element.addEventListener("pointerup", async () => {
      if (!element.dataset.id) {
        return;
      }
      await supabaseClient
        .from("board_items")
        .update({
          x: parseFloat(element.style.left),
          y: parseFloat(element.style.top),
        })
        .eq("id", element.dataset.id);
      start = null;
    });
  };

  const createNote = async (text) => {
    const item = await createItem("text", text);
    if (item) {
      renderItem(item);
    }
  };

  const createLink = async (url) => {
    const item = await createItem("link", url);
    if (item) {
      renderItem(item);
    }
  };

  const createImageFromFile = async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const item = await createItem("image", reader.result, { name: file.name });
      if (item) {
        renderItem(item);
      }
    };
    reader.readAsDataURL(file);
  };

  const { data: items } = await supabaseClient
    .from("board_items")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });
  items?.forEach(renderItem);

  document.addEventListener("paste", (event) => {
    const items = event.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          createImageFromFile(file);
          return;
        }
      }
      if (item.type === "text/plain") {
        item.getAsString((text) => {
          if (text.startsWith("http")) {
            createLink(text);
          }
        });
      }
    }
  });

  boardViewport.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    if (file.type.startsWith("image/")) {
      createImageFromFile(file);
      return;
    }
    if (file.type === "audio/mpeg") {
      handleAudioUpload(file);
    }
  });
  boardViewport.addEventListener("dragover", (event) => event.preventDefault());

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const setWaveformSize = () => {
    const scale = window.devicePixelRatio || 1;
    waveform.width = waveform.clientWidth * scale;
    waveform.height = 80 * scale;
    waveCtx.setTransform(scale, 0, 0, scale, 0, 0);
  };

  const drawWaveform = (buffer) => {
    setWaveformSize();
    const width = waveform.clientWidth;
    const height = waveform.clientHeight || 80;
    waveCtx.clearRect(0, 0, width, height);
    waveCtx.fillStyle = "rgba(255,255,255,0.2)";
    const channelData = buffer.getChannelData(0);
    const step = Math.ceil(channelData.length / width);
    const amp = height / 2;
    for (let i = 0; i < width; i += 1) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j += 1) {
        const datum = channelData[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      waveCtx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  };

  const loadAudio = async (url, name) => {
    audio.src = url;
    audioName.textContent = name || "Audio track";
    audio.addEventListener("loadedmetadata", () => {
      totalTimeEl.textContent = formatTime(audio.duration || 0);
      audioSeek.value = "0";
      supabaseClient
        .from("boards")
        .update({ audio_duration: Math.round(audio.duration || 0) })
        .eq("id", boardId);
    });
    audio.addEventListener("timeupdate", () => {
      currentTimeEl.textContent = formatTime(audio.currentTime || 0);
      if (audio.duration) {
        audioSeek.value = String((audio.currentTime / audio.duration) * 100);
      }
    });
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = await audioCtx.decodeAudioData(arrayBuffer);
    drawWaveform(buffer);
  };

  const handleAudioUpload = async (file) => {
    const path = `${session.user.id}/${boardId}/${Date.now()}-${file.name}`;
    await supabaseClient.storage.from("boards-audio").upload(path, file);
    const { data: publicData } = supabaseClient.storage.from("boards-audio").getPublicUrl(path);
    await supabaseClient
      .from("boards")
      .update({
        audio_url: publicData.publicUrl,
        audio_name: file.name,
      })
      .eq("id", boardId);
    loadAudio(publicData.publicUrl, file.name);
  };

  if (board.audio_url) {
    loadAudio(board.audio_url, board.audio_name);
  }

  audioFile.addEventListener("change", () => {
    const file = audioFile.files?.[0];
    if (file) {
      handleAudioUpload(file);
    }
  });

  audioPlay.addEventListener("click", () => {
    if (audio.paused) {
      audio.play();
      audioPlay.textContent = "⏸";
    } else {
      audio.pause();
      audioPlay.textContent = "▶";
    }
  });

  audioSeek.addEventListener("input", () => {
    if (!audio.duration) {
      return;
    }
    audio.currentTime = (Number(audioSeek.value) / 100) * audio.duration;
  });

  audioVolume.addEventListener("input", () => {
    audio.volume = Number(audioVolume.value);
  });

  setTool("pan");
};

if (supabaseClient) {
  getSession().then((session) => {
    setAuthUI(session);
    const page = document.body.dataset.page;
    if (page === "storyboard-dashboard") {
      initDashboard(session);
    }
    if (page === "storyboard-board") {
      initBoard(session);
    }
  });
}
