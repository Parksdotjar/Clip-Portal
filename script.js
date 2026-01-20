const revealItems = document.querySelectorAll(".reveal");
const loader = document.querySelector(".loader");
const body = document.body;
const cursor = document.querySelector(".cursor-dot");
const themeToggle = document.querySelector(".theme-toggle");
const player = document.querySelector(".playlist-player");

const setCursorPosition = (event) => {
  if (!cursor) {
    return;
  }
  const { clientX, clientY } = event;
  cursor.style.left = `${clientX}px`;
  cursor.style.top = `${clientY}px`;
};

window.addEventListener("mousemove", setCursorPosition);
window.addEventListener("touchmove", setCursorPosition, { passive: true });

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
          playButton.textContent = "Pause";
        }
      })
      .catch(() => {});
  };

  const pauseTrack = () => {
    playerAudio.pause();
    const playButton = player.querySelector('[data-action="play"]');
    if (playButton) {
      playButton.textContent = "Play";
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

  return playerAudio;
};

const playlistReady = setupPlayer();
setTimeout(() => startExperience(playlistReady), 2000);
