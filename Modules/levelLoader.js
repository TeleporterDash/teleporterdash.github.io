// Level Loader for Teleporter Dash
const LevelLoader = {
        // // "Initialize" Variables
    db: null,
    DB_NAME: 'TeleporterDashDB',
    STORE_NAME: 'downloadedLevels',
    DB_VERSION: 2,
    GITHUB_API_BASE: 'https://api.github.com/repos/NellowTCS/TeleporterDashLevels',
    RAW_CONTENT_BASE: 'https://raw.githubusercontent.com/NellowTCS/TeleporterDashLevels/main',


        // // Load from Github
    async loadFromGithub(filename) {
        try {
            const response = await fetch(`${this.RAW_CONTENT_BASE}/${filename}`);
            if (!response.ok) {
                throw new Error('Failed to fetch level');
            }
            const levelCode = await response.text();

            // Create a safe environment to evaluate the level code
            const levelData = new Function(`
                window = {};
                ${levelCode}
                return window.levelData;
            `)();

            return levelData;
        } catch (error) {
            console.error('Error loading level:', error);
            throw error;
        }
    },

        // // Load from IndexedDB
    async loadFromIndexedDB(filename) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            try {
                const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.get(filename);

                request.onsuccess = () => {
                    if (request.result) {
                        resolve(request.result);
                    } else {
                        reject(new Error('Level not found in local storage'));
                    }
                };

                request.onerror = () => {
                    reject(request.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    },

        // // Load Test Level
    async loadTestLevel() {
        const dbName = 'LevelEditorDB';
        const testStore = 'testLevel';

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1);

            request.onerror = () => reject(new Error('Failed to open database'));

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(testStore)) {
                    db.createObjectStore(testStore, { keyPath: 'currentTest' });
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction([testStore], 'readonly');
                const store = transaction.objectStore(testStore);
                const getRequest = store.get('currentTest');

                getRequest.onsuccess = () => {
                    const testData = getRequest.result;
                    if (testData) {
                        resolve({
                            matrix: testData.matrix,
                            title: 'Test Level',
                            author: testData.author,
                            difficulty: testData.difficulty,
                            musicValue: testData.musicValue,
                            musicData: testData.musicData,
                            id: 'test',
                            colorTransitionDuration: 2.0,
                            colorTransitionDelay: 0.2
                        });
                    } else {
                        reject(new Error('No test level found'));
                    }
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(testStore)) {
                        db.createObjectStore(testStore, { keyPath: 'currentTest' });
                    }
                };

                getRequest.onerror = () => reject(new Error('Failed to load test level'));
            };
        });
    },

        // // Initialize Database
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
    
            request.onerror = () => {
                console.error("Database error:", request.error);
                reject(new Error('Failed to open database'));
            };
    
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("Database opened successfully");
                resolve(this.db);
            };
    
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME);
                    console.log("Object store created");
                }
                if (!db.objectStoreNames.contains('scores')) {
                    db.createObjectStore('scores');
                    console.log("Scores object store created");
                }
            };
        });
    },

        // // Initialize Level Data
    async initializeLevelData() {
        try {
            const urlParams = new URLSearchParams(window.location.search);

            // Test level from the editor
            if (urlParams.has('test') && urlParams.get('test') === 'true') {
                console.log('Loading test level from editor');
                const testData = await this.loadTestLevel();
                await this.processLevelData(testData);
                requestAnimationFrame(updateGame);
                if (isPracticeMode) {
                    this.initializePracticeMode();
                }
                return;
            }

            // Online levels
            if (urlParams.has('online') && urlParams.get('online') === 'true') {
                console.log('Loading online level');
                const levelTitle = urlParams.get('levelFile');
                console.log('Loading level:', levelTitle);

                try {
                    if (!this.db) {
                        throw new Error('Database not initialized');
                    }

                    const level = await this.loadFromIndexedDB(levelTitle);
                    console.log('Level loaded from IndexedDB:', level);

                    if (!level || !level.matrix) {
                        throw new Error('Invalid level data');
                    }

                    await this.processLevelData(level);
                    console.log('Level processed successfully');
                } catch (error) {
                    console.error('Error loading online level:', error);
                    showLoadingError(`Failed to load level: ${error.message}`);
                    throw error;
                }
                return;
            }

            // Built-in levels
            if (urlParams.has('level')) {
                console.log('Loading built-in level');
                const levelNumber = urlParams.get('level');
                if (!/^\d+$/.test(levelNumber)) {
                    showLoadingError("Invalid level number");
                    return;
                }
                console.log('Loading level:', levelNumber);

                // Dynamically load the level script file
                const levelScript = document.createElement('script');
                levelScript.src = `level${levelNumber}.js`;
                console.log('Created script element for:', levelScript.src);

                await new Promise((resolve, reject) => {
                    levelScript.onload = () => {
                        console.log('Level script loaded');
                        if (window.levelData) {
                            console.log('Level data found:', window.levelData);
                            this.processLevelData(window.levelData)
                                .then(() => {
                                    requestAnimationFrame(updateGame);
                                    if (isPracticeMode) {
                                        this.initializePracticeMode();
                                    }
                                    resolve();
                                })
                                .catch(reject);
                        } else {
                            reject(new Error('Level data not found in loaded script'));
                        }
                    };

                    levelScript.onerror = (error) => {
                        console.error('Error loading level script:', error);
                        showLoadingError(`Failed to load level ${levelNumber}`);
                        reject(error);
                    };

                    document.body.appendChild(levelScript);
                });
            }
        } catch (error) {
            console.error('Error initializing level data:', error);
            showLoadingError(`Failed to initialize level: ${error.message}`);
            throw error;
        }
    },

        // // Process Level Data
    async processLevelData(data) {
        if (!data || !data.matrix) {
            throw new Error('Invalid level data: missing matrix');
        }

        // For built-in levels, first row is already the color row
        levelMatrix = data.matrix.slice(1);
        levelColorRow = data.matrix[0];  // Store color row separately

        // Process colors
        colorSteps.length = 0;
        const uniqueColors = [...new Set(levelColorRow)].filter(code => {
            // Handle both simple color codes and block properties
            if (typeof code === 'string') {
                const props = code.split('/');
                return props.some(p => p.startsWith('-'));
            }
            return code < 0;
        }).map(code => {
            // Extract color from block properties if needed
            if (typeof code === 'string') {
                const props = code.split('/');
                const colorProp = props.find(p => p.startsWith('-'));
                return parseInt(colorProp);
            }
            return code;
        });

        uniqueColors.forEach(code => {
            const color = COLOR_MAP[code];
            if (color) {
                colorSteps.push(color);
            }
        });

        // If we only have one color, duplicate it
        if (colorSteps.length === 1) {
            console.log('Only one color found, duplicating it');
            colorSteps.push(colorSteps[0]);
        }

        // Reset color transition
        colorIndex = 0;
        transitionFactor = 0;

        // Set initial background color
        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer && colorSteps.length > 0) {
            gameContainer.style.backgroundColor = colorSteps[0];
        }

        // Set other level data
        levelTitle = data.title || 'Untitled Level';
        levelAuthor = data.author || 'Unknown Author';
        levelDifficulty = data.difficulty || 'Normal';

        // Handle music data
        if (data.musicValue === 'custom' && data.musicData) {
            const blob = new Blob([data.musicData.data], { type: data.musicData.type });
            levelMusic = URL.createObjectURL(blob);
            console.log('LevelMusic: ', levelMusic);
        } else if (isPracticeMode) {
            levelMusic = '../Sound/Basic Soundeffects/practicetd.ogg';
            console.log('LevelMusic: ', levelMusic);
        } else if (data.musicValue && data.musicValue.startsWith('../Sound/Level Soundtracks/')) {
            levelMusic = `${data.musicValue}`;
            console.log('LevelMusic: ', levelMusic);
        } else if (data.musicValue) {
            levelMusic = `../Sound/Level Soundtracks/${data.musicValue}`;
            console.log('LevelMusic: ', levelMusic);
        } else if (data.musicData) {
            levelMusic = `${data.musicData}`;
            console.log('LevelMusic: ', levelMusic);
        } else if (data.music && data.music.startsWith('../Sound/Level Soundtracks/')) {
            levelMusic = `${data.music}`;
            console.log('LevelMusic: ', levelMusic);
        } else if (data.music) {
            levelMusic = `../Sound/Level Soundtracks/${data.music}`;
            console.log('LevelMusic: ', levelMusic);
        } else {
            levelMusic = '../Sound/Level Soundtracks/level1.ogg';
            console.log('LevelMusic: ', levelMusic);
        }

        // Ensure Safari gets .mp3 instead of .ogg
        if (AudioManager.isSafari() && !levelMusic.endsWith('.mp3')) {
            levelMusic = levelMusic.replace(/\.\w+$/, '.mp3');
            console.log('LevelMusic: ', levelMusic);
        }
        
        levelId = data.id;
        document.title = levelTitle;

        // Initialize audio with the new level music
        await AudioManager.setup(levelMusic);

        // Initialize game systems
        requestAnimationFrame(updateGame);
        calculateTotalBlocks();

        // Reset game state
        gameSpeed = 4;
        currentColumn = 0;
        playerVelocity = 0;
        rotation = 0;
        isOnPlatform = false;
        doubleJumpAvailable = true;
        passedBlocks = 0;

        // Reset progress bar
        progressFill.style.width = '0%';
        progressText.textContent = '0%';

        // Reset player position
        player.style.bottom = `${CONSTANTS.GROUND_HEIGHT}px`;
        player.style.transform = 'rotate(0deg)';

        // Reset camera position
        cameraOffsetY = 0;
    },
    // // Initialize Practice Mode
    initializePracticeMode() {
        const gameSpeedSelect = document.getElementById('gameSpeed');
        if (gameSpeedSelect) {
            gameSpeedSelect.disabled = false;
            if (SettingsManager.current.gameSpeed) {
                gameSpeed = SettingsManager.current.gameSpeed;
                gameSpeedSelect.value = gameSpeed.toString();
            }
        }

        // Switch to practice mode music
        if (isLevelStarted && !isPaused && !isGameOver && !isLevelComplete) {
            try {
                AudioManager.switchTracks(AudioManager.practiceMusic, AudioManager.backgroundMusic);
            } catch (error) {
                console.error("Error switching to practice mode music:", error);
            }
        }
    }
};
