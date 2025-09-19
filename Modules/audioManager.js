// Audio Manager for Teleporter Dash
const AudioManager = {
  // // "Initialize" Variables
  backgroundMusic: null,
  practiceMusic: null,
  jumpSound: null,
  deathSound: null,
  completionSound: null,
  isMuted: false,
  lastMusicTime: 0,
  isInitialized: false,

  // // Function to detect if the browser is Safari
  isSafari() {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes("safari") && !userAgent.includes("chrome");
  },

  // // Play Audio
  async play(audio, startTime = 0) {
    if (!audio) return;
    try {
      await audio.play();
      // Set time after starting playback to avoid reset
      if (startTime !== undefined && startTime > 0) {
        audio.currentTime = startTime;
      }
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  },

  // // Pause Audio
  async pause(audio) {
    if (!audio) return;
    try {
      audio.pause();
    } catch (error) {
      console.error("Error pausing audio:", error);
    }
  },

  // // Switch Audio
  async switchTracks(trackToPlay, trackToPause) {
    if (!trackToPlay || !trackToPause) return;
    const currentTime = trackToPause.currentTime;
    await this.pause(trackToPause);
    if (!this.isMuted) {
      await this.play(trackToPlay, currentTime);
    }
  },

  // // Initialize Audio
  async initialize(levelMusicPath) {
    if (this.isInitialized) {
      // If already initialized, just update the background music source
      await this.pause(this.backgroundMusic);
      this.backgroundMusic = new Audio(levelMusicPath);
      this.backgroundMusic.loop = true;
      return;
    }

    // Initialize all audio elements with MP3 or OGG based on browser
    const musicPath =
      this.isSafari() && !levelMusicPath.endsWith(".mp3")
        ? levelMusicPath.replace(/\.\w+$/, ".mp3")
        : levelMusicPath;
    const practiceMusicPath = this.isSafari()
      ? "../Sound/Basic Soundeffects/practicetd.ogg".replace(".ogg", ".mp3")
      : "../Sound/Basic Soundeffects/practicetd.ogg";
    const jumpSoundPath = this.isSafari()
      ? "../Sound/Basic Soundeffects/jumptd.ogg".replace(".ogg", ".mp3")
      : "../Sound/Basic Soundeffects/jumptd.ogg";
    const deathSoundPath = this.isSafari()
      ? "../Sound/Basic Soundeffects/deathtd.ogg".replace(".ogg", ".mp3")
      : "../Sound/Basic Soundeffects/deathtd.ogg";
    const completionSoundPath = this.isSafari()
      ? "../Sound/Basic Soundeffects/lvlcompletetd.ogg".replace(".ogg", ".mp3")
      : "../Sound/Basic Soundeffects/lvlcompletetd.ogg";

    // Initialize the audio elements
    this.backgroundMusic = new Audio(musicPath);
    this.practiceMusic = new Audio(practiceMusicPath);
    this.jumpSound = new Audio(jumpSoundPath);
    this.deathSound = new Audio(deathSoundPath);
    this.completionSound = new Audio(completionSoundPath);

    this.isInitialized = true;
  },

  // // Setup/Update Audio
  async setup(levelMusicPath) {
    // Initialize or update audio elements
    await this.initialize(levelMusicPath);

    try {
      // Set audio properties
      this.backgroundMusic.loop = true;
      this.practiceMusic.loop = true;

      // Set volumes
      const volumeLevel = document.getElementById("volumeSlider").value / 100;
      this.backgroundMusic.volume = volumeLevel * 0.6;
      this.practiceMusic.volume = volumeLevel * 0.6;
      this.jumpSound.volume = volumeLevel * 0.2;
      this.deathSound.volume = volumeLevel * 0.7;
      this.completionSound.volume = volumeLevel * 0.7;

      // Set initial mute states
      [
        this.backgroundMusic,
        this.practiceMusic,
        this.jumpSound,
        this.deathSound,
        this.completionSound,
      ].forEach((audio) => {
        if (audio) audio.muted = this.isMuted;
      });

      // Create load promises for each audio element
      const loadPromises = [
        this.createLoadPromise(this.backgroundMusic),
        this.createLoadPromise(this.practiceMusic),
        this.createLoadPromise(this.jumpSound),
        this.createLoadPromise(this.deathSound),
        this.createLoadPromise(this.completionSound),
      ];

      // Start loading all audio files
      this.backgroundMusic.load();
      this.practiceMusic.load();
      this.jumpSound.load();
      this.deathSound.load();
      this.completionSound.load();

      // Wait for all audio to be ready
      await Promise.all(loadPromises);
      console.log("All audio loaded successfully");
    } catch (error) {
      console.error("Audio setup failed:", error);
      throw error;
    }
  },

  // // Event Listener
  async restart() {
    if (this.backgroundMusic) {
      this.backgroundMusic.currentTime = 0;
      if (!this.isMuted) {
        try {
          await this.play(this.backgroundMusic);
        } catch (error) {
          console.error("Failed to restart audio:", error);
        }
      }
    }
  },

  createLoadPromise(audio) {
    return new Promise((resolve, reject) => {
      audio.addEventListener("canplaythrough", resolve, { once: true });
      audio.addEventListener("error", reject, { once: true });
    });
  },

  // // Fade Out Audio at Level Completion
  async fadeOut(audio, duration = 1000) {
    if (!audio || audio.paused) return;

    const startVolume = audio.volume;
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = startVolume / steps;

    for (let i = steps; i > 0; i--) {
      audio.volume = volumeStep * i;
      await new Promise((resolve) => setTimeout(resolve, stepTime));
    }

    await this.pause(audio);
    audio.volume = startVolume;
  },

  // // Mute
  toggleMute() {
    this.isMuted = !this.isMuted;
    SettingsManager.current.isMuted = this.isMuted;
    SettingsManager.save();

    const currentMusic = isPracticeMode
      ? this.practiceMusic
      : this.backgroundMusic;

    if (this.isMuted) {
      this.lastMusicTime = currentMusic.currentTime;
      this.pause(currentMusic);
    } else if (isLevelStarted && !isPaused && !isGameOver && !isLevelComplete) {
      // Don't set currentTime before play, let play handle it
      this.play(currentMusic, this.lastMusicTime).catch((e) =>
        console.error("Error playing music:", e)
      );
    }

    // Update volume for all audio elements
    [
      this.backgroundMusic,
      this.practiceMusic,
      this.jumpSound,
      this.deathSound,
      this.completionSound,
    ].forEach((audio) => {
      if (audio) {
        audio.volume = SettingsManager.current.volume / 100;
      }
    });
  },
};
