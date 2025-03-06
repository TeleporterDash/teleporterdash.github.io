// Score Manager for Teleporter Dash
const ScoreManager = {
    // Default scores structure using Map
    scores: {
        levels: new Map()
    },
    db: null,
    dbVersion: 2, 
    // Initialize IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TeleporterDashDB', this.dbVersion);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Database opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                console.log('Database upgrade needed');
                const db = event.target.result;
                if (!db.objectStoreNames.contains('scores')) {
                    const store = db.createObjectStore('scores');
                    console.log('Scores object store created');
                }
            };
        });
    },

    // Initialize scores from IndexedDB or fallback to memory
    async initialize() {
        try {
            console.log('Initializing scores...');
            await this.initDB();
            
            // If database isn't initialized, use memory storage
            if (!this.db) {
                console.log('Using memory storage fallback');
                this.scores = { levels: new Map() };
                return;
            }

            try {
                const transaction = this.db.transaction(['scores'], 'readonly');
                const store = transaction.objectStore('scores');
                
                return new Promise((resolve, reject) => {
                    const request = store.getAll();
                    const keysRequest = store.getAllKeys();
                    
                    request.onsuccess = () => {
                        keysRequest.onsuccess = () => {
                            const scores = request.result;
                            const keys = keysRequest.result;
                            this.scores.levels = new Map();
                            
                            for (let i = 0; i < scores.length; i++) {
                                const filename = keys[i];
                                this.scores.levels.set(filename, scores[i]);
                            }
                            console.log('Scores loaded successfully');
                            resolve();
                        };
                    };
                    
                    request.onerror = () => {
                        console.error('Error loading scores:', request.error);
                        this.scores = { levels: new Map() };
                        resolve();
                    };
                });
            } catch (error) {
                console.error('Error accessing scores:', error);
                this.scores = { levels: new Map() };
            }
        } catch (error) {
            console.error('Error initializing scores:', error);
            this.scores = { levels: new Map() };
        }
    },

    // Save scores to IndexedDB with memory fallback
    async save() {
        try {
            if (!this.db) {
                console.log('No IndexedDB connection, using memory storage only');
                return;
            }

            try {
                const transaction = this.db.transaction(['scores'], 'readwrite');
                const store = transaction.objectStore('scores');

                for (const [filename, data] of this.scores.levels) {
                    await new Promise((resolve, reject) => {
                        const request = store.put(data, filename);
                        request.onsuccess = () => {
                            console.log(`Saved scores for level ${filename}`);
                            resolve();
                        };
                        request.onerror = () => {
                            console.error(`Error saving level ${filename}`);
                            resolve(); // Still resolve to continue with other levels
                        };
                    });
                }
                console.log('All scores saved successfully');
            } catch (error) {
                console.error('Transaction error:', error);
                // Continue with memory storage
            }
        } catch (error) {
            console.error('Error saving scores:', error);
            // Scores remain in memory
        }
    },

    // Add a new run for a level
    async addRun(filename, time, jumps, deaths = 0) {
        if (!this.scores.levels.has(filename)) {
            this.scores.levels.set(filename, {
                bestTime: Infinity,
                bestJumps: Infinity,
                lowestDeaths: Infinity,
                perfectRuns: 0,
                totalDeaths: 0,
                totalRuns: 0,
                recentRuns: []
            });
        }

        const level = this.scores.levels.get(filename);
        const run = {
            time,
            jumps,
            deaths,
            date: new Date().toISOString()
        };

        // Update stats
        level.totalRuns++;
        level.totalDeaths += deaths;
        if (time < level.bestTime) level.bestTime = time;
        if (jumps < level.bestJumps) level.bestJumps = jumps;
        if (deaths < level.lowestDeaths) level.lowestDeaths = deaths;
        if (deaths === 0) level.perfectRuns++;

        // Add to recent runs (keep last 5)
        level.recentRuns.unshift(run);
        if (level.recentRuns.length > 5) {
            level.recentRuns.pop();
        }

        await this.save();
        this.updateScoreboardUI(filename);
    },

    // Get level stats
    getLevelStats(filename) {
        return this.scores.levels.get(filename) || {
            bestTime: Infinity,
            bestJumps: Infinity,
            lowestDeaths: Infinity,
            perfectRuns: 0,
            totalDeaths: 0,
            totalRuns: 0,
            recentRuns: []
        };
    },

    // Format time for display
    formatTime(time) {
        return time === Infinity ? '--' : time.toFixed(1) + 's';
    },

    // Create scoreboard UI
    createScoreboardUI() {
        const scoreboard = document.createElement('div');
        scoreboard.id = 'scoreboard';
        scoreboard.style.cssText = `
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.6));
            color: white;
            padding: 20px;
            border-radius: 15px;
            font-family: 'Orbitron', sans-serif;
            min-width: 250px;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.2);
            border: 1px solid rgba(0, 255, 0, 0.1);
            backdrop-filter: blur(10px);
            z-index: 1000;
        `;
        document.body.appendChild(scoreboard);
        return scoreboard;
    },

    // Update scoreboard UI
    updateScoreboardUI(filename) {
        let scoreboard = document.getElementById('scoreboard');
        if (!scoreboard) {
            scoreboard = this.createScoreboardUI();
        }
        
        const stats = this.getLevelStats(filename);
    
        // Clear existing content
        scoreboard.innerHTML = '';
    
        // Create and append the title (h3) using textContent to safely handle filename
        const title = document.createElement('h3');
        title.textContent = `${filename} Stats`; // Safe: textContent doesn't interpret HTML
        title.style.cssText = 'margin: 0 0 15px 0; color: #00ff00; text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);';
        scoreboard.appendChild(title);
    
        // Best stats section
        const bestStatsDiv = document.createElement('div');
        bestStatsDiv.style.cssText = 'background: rgba(0, 255, 0, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 15px;';
        bestStatsDiv.innerHTML = `
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
                <span>Best Time:</span>
                <span style="color: #00ff00;">${this.formatTime(stats.bestTime)}</span>
            </div>
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
                <span>Best Jumps:</span>
                <span style="color: #00ff00;">${stats.bestJumps === Infinity ? '--' : stats.bestJumps}</span>
            </div>
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
                <span>Lowest Deaths:</span>
                <span style="color: #00ff00;">${stats.lowestDeaths === Infinity ? '--' : stats.lowestDeaths}</span>
            </div>
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
                <span>Perfect Runs:</span>
                <span style="color: #00ff00;">${stats.perfectRuns}</span>
            </div>
        `;
        scoreboard.appendChild(bestStatsDiv);
    
        // Total stats section
        const totalStatsDiv = document.createElement('div');
        totalStatsDiv.style.cssText = 'background: rgba(0, 255, 0, 0.05); padding: 15px; border-radius: 10px;';
        totalStatsDiv.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: #00ff00;">Total Stats</h4>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Total Runs:</span>
                <span>${stats.totalRuns}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Total Deaths:</span>
                <span>${stats.totalDeaths}</span>
            </div>
        `;
        scoreboard.appendChild(totalStatsDiv);
    
        // Recent runs section (if applicable)
        if (stats.recentRuns.length > 0) {
            const recentRunsDiv = document.createElement('div');
            recentRunsDiv.style.cssText = 'margin-top: 15px;';
            recentRunsDiv.innerHTML = `
                <h4 style="margin: 0 0 10px 0; color: #00ff00;">Recent Runs</h4>
                ${stats.recentRuns.map(run => `
                    <div style="background: rgba(0, 255, 0, 0.05); padding: 10px; border-radius: 8px; margin-bottom: 5px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>${this.formatTime(run.time)}</span>
                            <span>${run.jumps} jumps</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: #aaa;">
                            <span>${run.deaths} deaths</span>
                            <span>${new Date(run.date).toLocaleDateString()}</span>
                        </div>
                    </div>
                `).join('')}
            `;
            scoreboard.appendChild(recentRunsDiv);
        }
    },

    // Create menu scoreboard UI
    createMenuScoreboardUI() {
        const menuScoreboard = document.createElement('div');
        menuScoreboard.id = 'menuScoreboard';
        menuScoreboard.style.cssText = `
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.6));
            color: white;
            padding: 20px;
            border-radius: 15px;
            font-family: 'Orbitron', sans-serif;
            min-width: 300px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.2);
            border: 1px solid rgba(0, 255, 0, 0.1);
            backdrop-filter: blur(10px);
            z-index: 1000;
        `;
        document.body.appendChild(menuScoreboard);
        return menuScoreboard;
    },

    // Update menu scoreboard UI
    updateMenuScoreboardUI() {
        let menuScoreboard = document.getElementById('menuScoreboard');
        if (!menuScoreboard) {
            menuScoreboard = this.createMenuScoreboardUI();
        }

        let html = '<h2 style="margin: 0 0 20px 0; color: #00ff00; text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);">Level Statistics</h2>';
        
        const levelIds = Array.from(this.scores.levels.keys()).sort((a, b) => {
            const numA = parseInt(a.replace('level', ''));
            const numB = parseInt(b.replace('level', ''));
            return numA - numB;
        });

        for (const levelId of levelIds) {
            const stats = this.getLevelStats(levelId);
            html += `
                <div style="margin-bottom: 20px; border: 1px solid rgba(0, 255, 0, 0.1); border-radius: 10px; padding: 15px; background: rgba(0, 255, 0, 0.05);">
                    <h3 style="margin: 0 0 10px 0; color: #00ff00; text-shadow: 0 0 10px rgba(0, 255, 0, 0.3);">${levelId}</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div>Best Time: ${this.formatTime(stats.bestTime)}</div>
                        <div>Best Jumps: ${stats.bestJumps === Infinity ? '--' : stats.bestJumps}</div>
                        <div>Perfect Runs: ${stats.perfectRuns}</div>
                        <div>Total Deaths: ${stats.totalDeaths}</div>
                    </div>
                    ${stats.recentRuns.length > 0 ? `
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0, 255, 0, 0.1);">
                            <div style="font-size: 0.9em; color: #00ff00;">Last Run:</div>
                            <div style="display: flex; justify-content: space-between; color: #aaa;">
                                <span>${this.formatTime(stats.recentRuns[0].time)}</span>
                                <span>${stats.recentRuns[0].jumps} jumps</span>
                                <span>${stats.recentRuns[0].deaths} deaths</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        if (levelIds.length === 0) {
            html += '<div style="color: #aaa; text-align: center; padding: 20px;">No levels completed yet</div>';
        }

        menuScoreboard.innerHTML = html;
    }
};
