const revealItems = document.querySelectorAll(".reveal");
const loader = document.querySelector(".loader");
const body = document.body;
const cursor = document.querySelector(".cursor-dot");
const cursorRing = document.querySelector(".cursor-ring");
const themeToggle = document.querySelector(".theme-toggle");
const player = document.querySelector(".playlist-player");
const supabaseUrl = "https://styegsfyqtjgiykiuztv.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0eWVnc2Z5cXRqZ2l5a2l1enR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NzIxODEsImV4cCI6MjA4NDQ0ODE4MX0.Or1BE7mVUNyoeI-CCax1DzvjNXCcScayVlh8ZQeAYYs";
const supabaseClient = window.supabase
  ? window.supabase.createClient(supabaseUrl, supabaseKey)
  : null;

const setCursorPosition = (event) => {
  if (!cursor) {
    return;
  }
  const { clientX, clientY } = event;
  cursor.style.left = `${clientX}px`;
  cursor.style.top = `${clientY}px`;
  if (cursorRing) {
    cursorRing.style.left = `${clientX}px`;
    cursorRing.style.top = `${clientY}px`;
  }
};

window.addEventListener("mousemove", setCursorPosition);
window.addEventListener("touchmove", setCursorPosition, { passive: true });

const clickableSelector = "button, a, [role='button'], video";
const textInputSelector = "input, textarea, select";

const setCursorState = (event) => {
  const target = event.target;
  if (target.closest(textInputSelector)) {
    body.classList.add("cursor-text");
    body.classList.remove("cursor-button");
    body.classList.remove("cursor-hover");
    return;
  }
  if (target.closest(clickableSelector)) {
    body.classList.add("cursor-button");
    body.classList.remove("cursor-text");
    body.classList.remove("cursor-hover");
    return;
  }
  body.classList.remove("cursor-text");
  body.classList.remove("cursor-button");
  body.classList.remove("cursor-hover");
};

document.addEventListener("pointerover", setCursorState);
document.addEventListener("pointermove", setCursorState);
document.addEventListener("pointerout", setCursorState);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.2 }
);

revealItems.forEach((item) => observer.observe(item));

const setTheme = (mode) => {
  if (mode === "dark") {
    body.classList.add("dark");
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", "true");
    }
  } else {
    body.classList.remove("dark");
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", "false");
    }
  }
};

const storedTheme = localStorage.getItem("clip-portal-theme");
if (storedTheme) {
  setTheme(storedTheme);
} else {
  setTheme("dark");
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = body.classList.contains("dark") ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("clip-portal-theme", nextTheme);
  });
}

const fadeInAudio = (audioElement) => {
  if (!audioElement) {
    return;
  }
  audioElement.volume = 0;
  audioElement
    .play()
    .then(() => {
      let volume = 0;
      const step = 0.02;
      const interval = setInterval(() => {
        volume = Math.min(0.5, volume + step);
        audioElement.volume = volume;
        if (volume >= 0.5) {
          clearInterval(interval);
        }
      }, 120);
    })
    .catch(() => {});
};

const setLoaderLabel = () => {
  const loaderText = loader ? loader.querySelector("p") : null;
  const pageType = body.dataset.page || "home";
  const loaderLabels = {
    home: "Loading clip-portal",
    upload: "Loading uploader",
    signin: "Loading sign in",
    signup: "Loading sign up",
    info: "Loading info",
    dashboard: "Loading dashboard",
  };
  if (loaderText) {
    loaderText.textContent = loaderLabels[pageType] || "Loading clip-portal";
  }
};

const startExperience = (playlistReady) => {
  if (loader) {
    loader.classList.add("fade-out");
    setTimeout(() => loader.remove(), 900);
  }
  body.classList.remove("is-loading");
  revealItems.forEach((item) => item.classList.add("is-visible"));
  if (playlistReady) {
    playlistReady.then((audioElement) => fadeInAudio(audioElement));
  }
};

const fallbackTracks = [
  "songs/Afterglow Drift.mp3",
  "songs/Neon Skyline.mp3",
  "songs/Midnight Arcade.mp3",
  "songs/Soft Focus Loop.mp3",
];

const normalizeTrack = (track) => {
  if (typeof track === "string") {
    return { file: track, title: "" };
  }
  return { file: track.file, title: track.title || "" };
};

const titleFromFile = (file) => {
  const parts = file.split("/").pop().split("\\").pop().split(".");
  parts.pop();
  return decodeURIComponent(parts.join("."));
};

const loadPlaylist = async () => {
  try {
    const response = await fetch("songs/playlist.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Playlist not found");
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.tracks)) {
      throw new Error("Invalid playlist format");
    }
    return data.tracks.map(normalizeTrack);
  } catch (error) {
    return fallbackTracks.map(normalizeTrack);
  }
};

const setupPlayer = async () => {
  if (!player) {
    return null;
  }
  const playerAudio = player.querySelector("#playlist-audio");
  const trackText = player.querySelector(".track-text");
  const trackName = player.querySelector(".track-name");
  const toggleButton = player.querySelector(".player-toggle");
  const dragHandle = player.querySelector(".player-grip");
  const volumeSlider = player.querySelector(".volume-slider");
  const controlButtons = player.querySelectorAll("[data-action]");

  if (!playerAudio || !trackText || !trackName) {
    return null;
  }

  const tracks = await loadPlaylist();
  let currentIndex = 0;

  const updateTrackName = () => {
    const overflow = trackText.scrollWidth - trackName.clientWidth;
    if (overflow > 4) {
      trackName.classList.add("is-long");
      trackText.style.setProperty("--overflow", `${overflow}px`);
    } else {
      trackName.classList.remove("is-long");
      trackText.style.removeProperty("--overflow");
    }
  };

  const setTrack = (index) => {
    const track = tracks[index];
    if (!track) {
      trackText.textContent = "No tracks found";
      return;
    }
    const title = track.title || titleFromFile(track.file);
    playerAudio.src = track.file;
    trackText.textContent = title;
    requestAnimationFrame(updateTrackName);
  };

  const playTrack = () => {
    playerAudio
      .play()
      .then(() => {
        const playButton = player.querySelector('[data-action="play"]');
        if (playButton) {
          playButton.textContent = "⏸";
        }
      })
      .catch(() => {});
  };

  const pauseTrack = () => {
    playerAudio.pause();
    const playButton = player.querySelector('[data-action="play"]');
    if (playButton) {
      playButton.textContent = "▶";
    }
  };

  const nextTrack = () => {
    if (!tracks.length) {
      return;
    }
    currentIndex = (currentIndex + 1) % tracks.length;
    setTrack(currentIndex);
    playTrack();
  };

  const prevTrack = () => {
    if (!tracks.length) {
      return;
    }
    currentIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    setTrack(currentIndex);
    playTrack();
  };

  if (volumeSlider) {
    playerAudio.volume = parseFloat(volumeSlider.value);
    volumeSlider.addEventListener("input", (event) => {
      playerAudio.volume = parseFloat(event.target.value);
    });
  }

  controlButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "play") {
        if (playerAudio.paused) {
          playTrack();
        } else {
          pauseTrack();
        }
      }
      if (action === "next") {
        nextTrack();
      }
      if (action === "prev") {
        prevTrack();
      }
    });
  });

  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      const isOpen = player.classList.toggle("is-open");
      toggleButton.setAttribute("aria-expanded", String(isOpen));
      toggleButton.textContent = isOpen ? "^" : "v";
    });
  }

  playerAudio.addEventListener("ended", nextTrack);
  window.addEventListener("resize", updateTrackName);

  setTrack(currentIndex);
  player.classList.remove("is-open");
  if (toggleButton) {
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.textContent = "v";
  }

  const savedState = localStorage.getItem("clip-portal-player-state");
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      if (Number.isInteger(parsed.index) && tracks[parsed.index]) {
        currentIndex = parsed.index;
        setTrack(currentIndex);
      }
      if (typeof parsed.time === "number" && parsed.time > 0) {
        playerAudio.currentTime = parsed.time;
      }
      if (parsed.playing) {
        playTrack();
      }
    } catch (error) {
      localStorage.removeItem("clip-portal-player-state");
    }
  }

  const savedPosition = localStorage.getItem("clip-portal-player-pos");
  if (savedPosition) {
    try {
      const { x, y } = JSON.parse(savedPosition);
      player.style.left = `${x}px`;
      player.style.top = `${y}px`;
      player.style.right = "auto";
      player.style.bottom = "auto";
    } catch (error) {
      localStorage.removeItem("clip-portal-player-pos");
    }
  }

  if (dragHandle) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onPointerMove = (event) => {
      if (!isDragging) {
        return;
      }
      const x = event.clientX - offsetX;
      const y = event.clientY - offsetY;
      player.style.left = `${x}px`;
      player.style.top = `${y}px`;
      player.style.right = "auto";
      player.style.bottom = "auto";
    };

    const onPointerUp = (event) => {
      if (!isDragging) {
        return;
      }
      isDragging = false;
      if (event && event.pointerId !== undefined) {
        dragHandle.releasePointerCapture(event.pointerId);
      }
      const rect = player.getBoundingClientRect();
      localStorage.setItem("clip-portal-player-pos", JSON.stringify({ x: rect.left, y: rect.top }));
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    dragHandle.addEventListener("pointerdown", (event) => {
      isDragging = true;
      const rect = player.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      dragHandle.setPointerCapture(event.pointerId);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    });
  }

  const persistState = () => {
    localStorage.setItem(
      "clip-portal-player-state",
      JSON.stringify({
        index: currentIndex,
        time: playerAudio.currentTime,
        playing: !playerAudio.paused,
      })
    );
  };

  playerAudio.addEventListener("timeupdate", () => {
    if (playerAudio.currentTime % 5 < 0.25) {
      persistState();
    }
  });
  playerAudio.addEventListener("play", persistState);
  playerAudio.addEventListener("pause", persistState);
  playerAudio.addEventListener("ended", persistState);

  return playerAudio;
};

const playlistReady = setupPlayer();
if (player) {
  setTimeout(() => {
    player.classList.add("is-visible");
  }, 600);
}
setLoaderLabel();
setTimeout(() => startExperience(playlistReady), 2000);

const authLinks = document.querySelectorAll(".auth-link");
let cachedClips = [];
const userMenu = document.querySelector(".user-menu");
const avatarButton = userMenu ? userMenu.querySelector(".avatar-button") : null;
const userDropdown = userMenu ? userMenu.querySelector(".user-dropdown") : null;
const signOutButton = userMenu ? userMenu.querySelector('[data-action="signout"]') : null;

const toggleDropdown = (open) => {
  if (!userDropdown || !avatarButton) {
    return;
  }
  if (open) {
    userDropdown.classList.remove("hidden");
    avatarButton.setAttribute("aria-expanded", "true");
  } else {
    userDropdown.classList.add("hidden");
    avatarButton.setAttribute("aria-expanded", "false");
  }
};

const setAuthUI = (session) => {
  authLinks.forEach((link) => {
    link.classList.toggle("hidden", Boolean(session));
  });

  if (!userMenu || !avatarButton) {
    return;
  }

  if (session?.user?.email) {
    userMenu.classList.remove("hidden");
    avatarButton.textContent = session.user.email[0].toUpperCase();
  } else {
    userMenu.classList.add("hidden");
    toggleDropdown(false);
  }
};

const showMessage = (element, message, isError = false) => {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.classList.remove("hidden");
  element.classList.toggle("is-error", isError);
};

const clearMessage = (element) => {
  if (!element) {
    return;
  }
  element.textContent = "";
  element.classList.add("hidden");
  element.classList.remove("is-error");
};

const createClipCard = (clip) => {
  const card = document.createElement("article");
  card.className = "clip-card reveal";
  const tagList = Array.isArray(clip.tags) ? clip.tags.join(", ") : clip.tags || "";
  const tagLine = tagList ? `Tags: ${tagList}` : "Tags: none";
  card.innerHTML = `
    <video class="clip-media" src="${clip.file_url}" controls preload="metadata"></video>
    <div class="clip-info">
      <h3>${clip.title}</h3>
      <p>${tagLine}</p>
    </div>
    <div class="clip-actions">
      <a class="download-link" href="${clip.file_url}" data-filename="${clip.title}">Download</a>
    </div>
  `;
  observer.observe(card);
  return card;
};

const initHome = async () => {
  if (!supabaseClient) {
    return;
  }
  const list = document.querySelector("[data-clips-list]");
  const emptyState = document.querySelector("[data-clips-empty]");
  const searchInput = document.querySelector(".search-bar input");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  const { data, error } = await supabaseClient
    .from("clips")
    .select("id,title,tags,file_url,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    if (emptyState) {
      showMessage(emptyState, "Failed to load clips.");
    }
    return;
  }
  cachedClips = data || [];
  const renderClips = (clips) => {
    list.innerHTML = "";
    if (!clips || clips.length === 0) {
      if (emptyState) {
        emptyState.classList.remove("hidden");
      }
      return;
    }
    if (emptyState) {
      emptyState.classList.add("hidden");
    }
    clips.forEach((clip) => {
      list.appendChild(createClipCard(clip));
    });
  };

  renderClips(cachedClips);

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim().toLowerCase();
      if (!query) {
        renderClips(cachedClips);
        return;
      }
      const filtered = cachedClips.filter((clip) => {
        const title = clip.title?.toLowerCase() || "";
        const tags = Array.isArray(clip.tags) ? clip.tags.join(" ").toLowerCase() : "";
        return title.includes(query) || tags.includes(query);
      });
      renderClips(filtered);
    });
  }
};

const initUpload = async (session) => {
  if (!supabaseClient) {
    return;
  }
  const form = document.getElementById("upload-form");
  if (!form) {
    return;
  }
  const message = document.getElementById("upload-message");
  const progressWrap = document.getElementById("upload-progress");
  const progressBar = progressWrap ? progressWrap.querySelector(".progress-bar span") : null;
  const progressText = progressWrap ? progressWrap.querySelector(".progress-text") : null;
  const submitButton = form.querySelector('button[type="submit"]');
  if (!session) {
    showMessage(message, "You must sign in to upload a clip.", true);
    if (submitButton) {
      submitButton.disabled = true;
    }
    return;
  }
  if (submitButton) {
    submitButton.disabled = false;
  }

  const resetProgress = () => {
    if (progressBar) {
      progressBar.style.width = "0%";
    }
    if (progressText) {
      progressText.textContent = "Click publish to upload your video.";
    }
  };

  resetProgress();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage(message);
    if (progressBar) {
      progressBar.style.width = "0%";
    }
    if (progressText) {
      progressText.textContent = "Uploading...";
    }
    const title = document.getElementById("upload-title").value.trim();
    const fileInput = document.getElementById("upload-file");
    const tagsInput = document.getElementById("upload-tags").value.trim();
    const notes = document.getElementById("upload-notes").value.trim();
    const file = fileInput?.files?.[0];

    if (!title) {
      resetProgress();
      showMessage(message, "Please add a clip title.", true);
      return;
    }
    if (!file) {
      resetProgress();
      showMessage(message, "Please select a video file.", true);
      return;
    }

    const fileName = file.name.toLowerCase();
    const allowedTypes = ["video/mp4", "video/quicktime"];
    const allowedExtensions = [".mp4", ".mov"];
    const hasValidExt = allowedExtensions.some((ext) => fileName.endsWith(ext));
    if (!allowedTypes.includes(file.type) || !hasValidExt) {
      resetProgress();
      showMessage(message, "Video must be .mp4 or .mov.", true);
      return;
    }

    const timestamp = Date.now();
    const storagePath = `${session.user.id}/${timestamp}-${file.name}`;
    if (submitButton) {
      submitButton.disabled = true;
    }

    let simulatedProgress = 0;
    let progressTimer = null;
    if (progressBar) {
      progressTimer = setInterval(() => {
        simulatedProgress = Math.min(90, simulatedProgress + Math.random() * 8);
        progressBar.style.width = `${simulatedProgress.toFixed(0)}%`;
      }, 300);
    }

    const { error: uploadError } = await supabaseClient.storage.from("clips").upload(storagePath, file);

    if (uploadError) {
      if (progressTimer) {
        clearInterval(progressTimer);
      }
      const isBucketMissing = uploadError.message.toLowerCase().includes("bucket not found");
      const errorText = isBucketMissing
        ? "Upload failed: Bucket not found. Create a Supabase storage bucket named 'clips'."
        : `Upload failed: ${uploadError.message}`;
      resetProgress();
      showMessage(message, errorText, true);
      if (submitButton) {
        submitButton.disabled = false;
      }
      return;
    }

    if (progressTimer) {
      clearInterval(progressTimer);
    }
    if (progressBar) {
      progressBar.style.width = "100%";
    }
    if (progressText) {
      progressText.textContent = "Upload complete. Publishing...";
    }

    const { data: publicData } = supabaseClient.storage.from("clips").getPublicUrl(storagePath);
    const tagList = tagsInput
      ? tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];

    const { error: insertError } = await supabaseClient.from("clips").insert({
      user_id: session.user.id,
      title,
      tags: tagList,
      file_url: publicData.publicUrl,
      storage_path: storagePath,
      notes,
    });

    if (insertError) {
      resetProgress();
      showMessage(message, `Failed to save clip: ${insertError.message}`, true);
      if (submitButton) {
        submitButton.disabled = false;
      }
      return;
    }

    form.reset();
    if (progressText) {
      progressText.textContent = "Clip published.";
    }
    if (submitButton) {
      submitButton.disabled = false;
    }
    showMessage(message, "Clip published.");
  });
};

const initSignIn = () => {
  if (!supabaseClient) {
    return;
  }
  const form = document.getElementById("signin-form");
  if (!form) {
    return;
  }
  const message = document.getElementById("signin-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage(message);
    const email = document.getElementById("signin-email").value.trim();
    const password = document.getElementById("signin-password").value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      showMessage(message, error.message, true);
      return;
    }
    window.location.href = "dashboard.html";
  });
};

const initSignUp = () => {
  if (!supabaseClient) {
    return;
  }
  const form = document.getElementById("signup-form");
  if (!form) {
    return;
  }
  const message = document.getElementById("signup-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage(message);
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });

    if (error) {
      showMessage(message, error.message, true);
      return;
    }

    if (!data.session) {
      showMessage(message, "Check your email to confirm your account.");
      return;
    }

    window.location.href = "dashboard.html";
  });
};

const initDashboard = async (session) => {
  if (!supabaseClient) {
    return;
  }
  const list = document.querySelector("[data-dashboard-list]");
  if (!list) {
    return;
  }
  const emptyState = document.querySelector("[data-dashboard-empty]");
  const message = document.getElementById("dashboard-message");

  if (!session) {
    showMessage(message, "Please sign in to view your dashboard.", true);
    return;
  }

  const { data, error } = await supabaseClient
    .from("clips")
    .select("id,title,tags,file_url,storage_path,created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    showMessage(message, error.message, true);
    return;
  }

  list.innerHTML = "";
  if (!data || data.length === 0) {
    if (emptyState) {
      emptyState.classList.remove("hidden");
    }
    return;
  }

  if (emptyState) {
    emptyState.classList.add("hidden");
  }

  data.forEach((clip) => {
    const card = createClipCard(clip);
    const actions = card.querySelector(".clip-actions");
    const removeButton = document.createElement("button");
    removeButton.className = "delete-link";
    removeButton.type = "button";
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", async () => {
      clearMessage(message);
      removeButton.disabled = true;
      const { error: storageError } = await supabaseClient.storage
        .from("clips")
        .remove([clip.storage_path]);
      if (storageError) {
        showMessage(message, storageError.message, true);
        removeButton.disabled = false;
        return;
      }
      const { error: deleteError } = await supabaseClient.from("clips").delete().eq("id", clip.id);
      if (deleteError) {
        showMessage(message, deleteError.message, true);
        removeButton.disabled = false;
        return;
      }
      card.remove();
      if (list.children.length === 0 && emptyState) {
        emptyState.classList.remove("hidden");
      }
    });
    if (actions) {
      actions.appendChild(removeButton);
    }
    list.appendChild(card);
  });
};

if (supabaseClient) {
  supabaseClient.auth.getSession().then(({ data }) => {
    setAuthUI(data.session);
    initUpload(data.session);
    initDashboard(data.session);
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setAuthUI(session);
  });
}

if (avatarButton) {
  avatarButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = !userDropdown?.classList.contains("hidden");
    toggleDropdown(!isOpen);
  });
}

if (signOutButton && supabaseClient) {
  signOutButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    await supabaseClient.auth.signOut();
    toggleDropdown(false);
    window.location.href = "index.html";
  });
}

if (userDropdown) {
  userDropdown.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

document.addEventListener("click", (event) => {
  if (!userMenu || !userDropdown) {
    return;
  }
  if (!userMenu.contains(event.target)) {
    toggleDropdown(false);
  }
});

initHome();
initSignIn();
initSignUp();

document.addEventListener("click", async (event) => {
  const link = event.target.closest(".download-link");
  if (!link) {
    return;
  }
  event.preventDefault();
  const url = link.getAttribute("href");
  if (!url) {
    return;
  }
  const fileName = link.dataset.filename ? `${link.dataset.filename}.mp4` : "clip.mp4";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Download failed");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const temp = document.createElement("a");
    temp.href = objectUrl;
    temp.download = fileName;
    document.body.appendChild(temp);
    temp.click();
    temp.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    link.textContent = "Download failed";
    setTimeout(() => {
      link.textContent = "Download";
    }, 2000);
  }
});
