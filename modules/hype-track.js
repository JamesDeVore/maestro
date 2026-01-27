import * as MAESTRO from "./config.js";
import * as Playback from "./playback.js";

export default class HypeTrack {
    constructor() {
        this.playlist = null;
        this.pausedSounds = [];
    }

    /**
     * Checks for the presence of the Hype Tracks playlist, creates one if none exist
     */
    async _checkForHypeTracksPlaylist() {
        const enabled = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.HypeTrack.enable);
        if(!enabled) {
            return;
        } 

        const hypePlaylist = game.playlists.contents.find(p => p.name == MAESTRO.DEFAULT_CONFIG.HypeTrack.playlistName);
        if(!hypePlaylist && game.user.isGM) {
            this.playlist = await this._createHypeTracksPlaylist(true);
        } else {
            this.playlist = hypePlaylist || null;
        }

        const debugLogging = game.settings.get(
            MAESTRO.MODULE_NAME,
            MAESTRO.SETTINGS_KEYS.Misc.debugLogging
        );
        if (debugLogging) {
            console.debug("Maestro_pf2e | Hype playlist check", {
                enabled,
                playlistId: this.playlist?.id ?? null,
                playlistName: this.playlist?.name ?? null
            });
        }
    }

    /**
     * Create the Hype Tracks playlist if the create param is true
     * @param {Boolean} create - whether or not to create the playlist
     */
    async _createHypeTracksPlaylist(create) {
        if(create) {
            return await Playlist.create({"name": MAESTRO.DEFAULT_CONFIG.HypeTrack.playlistName});
        } else {
            return;
        }
    }

    /**
     * Checks for the existence of the Hype Track actor flag, then plays the track
     * @param {Object} combat - the combat instance
     * @param {*} update - the update data
     */
    async _processHype(combat, update) {
        const debugLogging = game.settings.get(
            MAESTRO.MODULE_NAME,
            MAESTRO.SETTINGS_KEYS.Misc.debugLogging
        );
        if (debugLogging) {
            console.log("Maestro_pf2e | _processHype called", { 
                turn: update.turn, 
                round: update.round,
                combatId: combat.id,
                combatants: combat.combatants?.size ?? combat.combatants?.length ?? "undefined",
                combatant: combat.combatant?.actor?.name ?? "none"
            });
        }
        const enabled = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.HypeTrack.enable);
        const turnChanged = typeof update.turn === "number";
        const roundChanged = typeof update.round === "number";

        if (!enabled) {
            if (debugLogging) {
                console.log("Maestro_pf2e | Hype skip: disabled");
            }
            return;
        }

        if (!turnChanged && !roundChanged) {
            if (debugLogging) {
                console.log("Maestro_pf2e | Hype skip: no turn/round change", update);
            }
            return;
        }

        const combatantsCount = combat.combatants?.size ?? combat.combatants?.length ?? 0;
        if (!combatantsCount) {
            if (debugLogging) {
                console.log("Maestro_pf2e | Hype skip: no combatants", {
                    combatants: combat.combatants,
                    hasCombatants: !!combat.combatants
                });
            }
            return;
        }

        if (!this.playlist) {
            if (debugLogging) {
                console.log("Maestro_pf2e | Hype: checking for playlist...");
            }
            await this._checkForHypeTracksPlaylist();
            if (!this.playlist) {
                if (debugLogging) {
                    console.log("Maestro_pf2e | Hype skip: no playlist");
                }
                return;
            }
        }

        if (debugLogging) {
            console.log("Maestro_pf2e | Hype: getting combatant", {
                hasCombatant: !!combat.combatant,
                combatTurn: combat.turn,
                combatantsSize: combat.combatants?.size ?? combat.combatants?.length
            });
        }
        
        const combatant = combat.combatant ?? (combat.combatants?.get ? combat.combatants.get(combat.turn) : null);
        if (!combatant?.actor) {
            if (debugLogging) {
                console.log("Maestro_pf2e | Hype skip: no combatant actor", {
                    combatId: combat?.id,
                    turn: combat?.turn,
                    combatant: combatant
                });
            }
            return;
        }
        
        if (debugLogging) {
            console.log("Maestro_pf2e | Hype: found combatant", {
                actorId: combatant.actor.id,
                actorName: combatant.actor.name
            });
        }

        // Stop any active hype tracks
        if (game.user.isGM && this?.playlist?.playing) {
            this.playlist.stopAll();
        }

        // Find the hype track
        const hypeTrack = this._getActorHypeTrack(combatant.actor);
        const pauseOthers = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.HypeTrack.pauseOthers);

        if (debugLogging) {
            console.log("Maestro_pf2e | Hype: track lookup", {
                hypeTrack: hypeTrack,
                actorId: combatant.actor.id,
                actorName: combatant.actor.name
            });
        }

        if (!hypeTrack) {
            if (this.pausedSounds.length) {
                // Resume any previously paused sounds
                Playback.resumeSounds(this.pausedSounds);
                this.pausedSounds = [];
            }
            
            if (debugLogging) {
                console.log("Maestro_pf2e | Hype skip: no track", {
                    actorId: combatant.actor.id,
                    actorName: combatant.actor.name
                });
            }
            return;
        }

        if (pauseOthers) {
            // pause active playlists
            this.pausedSounds = Playback.pauseAll() || [];
        } else {
            this.pausedSounds = [];
        }
        

        // Find the hype track's playlist sound and play it
        const hypeTrackSound = this.playlist.sounds?.get(hypeTrack) ?? this.playlist.sounds?.contents?.find(s => s._id === hypeTrack);

        if (debugLogging) {
            console.log("Maestro_pf2e | Hype: sound lookup", {
                trackId: hypeTrack,
                foundSound: !!hypeTrackSound,
                playlistId: this.playlist.id,
                playlistName: this.playlist.name,
                soundsCount: this.playlist.sounds?.size ?? this.playlist.sounds?.contents?.length
            });
        }

        if (game.user.isGM) {
            if (debugLogging) {
                console.log("Maestro_pf2e | Hype: calling playHype...");
            }
            await this.playHype(combatant.actor, {warn: false});
            if (debugLogging) {
                console.log("Maestro_pf2e | Hype: playHype completed");
            }
        }
        
        const soundInstance = hypeTrackSound?.sound;
        if (!soundInstance) {
            if (this.pausedSounds.length) {
                Playback.resumeSounds(this.pausedSounds);
                this.pausedSounds = [];
            }
            if (debugLogging) {
                console.log("Maestro_pf2e | Hype skip: sound instance missing", {
                    trackId: hypeTrack,
                    actorId: combatant.actor.id,
                    hasHypeTrackSound: !!hypeTrackSound
                });
            }
            return;
        }
        
        if (debugLogging) {
            console.log("Maestro_pf2e | Hype: sound instance found, setting up resume callback", {
                pausedSoundsLength: this.pausedSounds?.length ?? 0,
                pauseOthers: pauseOthers
            });
        }

        if (!this.pausedSounds || !this.pausedSounds.length) {
            if (debugLogging) {
                console.log("Maestro_pf2e | Hype: no paused sounds to resume, track should be playing");
            }
            return;
        }

        // Defer the resumption of paused sounds after hype track finishes
        if (typeof soundInstance.once === "function") {
            soundInstance.once("end", () => {
                Playback.resumeSounds(this.pausedSounds);
                this.pausedSounds = [];
            });
        } else {
            soundInstance.on("end", () => {
                Playback.resumeSounds(this.pausedSounds);
                this.pausedSounds = [];
            });
        }

        if (debugLogging) {
            console.debug("Maestro_pf2e | Hype track started", {
                actorId: combatant.actor.id,
                actorName: combatant.actor.name,
                trackId: hypeTrack,
                playlistId: this.playlist?.id
            });
        }
    }
    

    /**
     * Get the Hype Track flag if it exists on an actor
     * @param {*} actor
     * 
     */
    _getActorHypeTrack(actor) {
        let actorTrack;

        try {
            actorTrack = actor.getFlag(MAESTRO.MODULE_NAME, MAESTRO.DEFAULT_CONFIG.HypeTrack.flagNames.track);
            return actorTrack;
        } catch (e) {
            console.log(e);
            return;
        }

    }
    
    /**
     * Sets the Hype Track
     * @param {Number} trackId - Id of the track in the playlist 
     */
    async _setActorHypeTrack(actor, playlistId, trackId) {
        try {
            await actor.setFlag(MAESTRO.MODULE_NAME, MAESTRO.DEFAULT_CONFIG.HypeTrack.flagNames.playlist, playlistId || null);
            await actor.setFlag(MAESTRO.MODULE_NAME, MAESTRO.DEFAULT_CONFIG.HypeTrack.flagNames.track, trackId || null);
        } catch (e) {
            //we should do something with this in the future, eg. if the flag can't be found
            throw e
        }
    }
    
    /**
     * Adds a button to the Actor sheet to open the Hype Track form
     * @param {Object} app 
     * @param {Object} html 
     * @param {Object} data 
     */
    async _addHypeButton (app, html, data) {
        const actor = app.actor ?? app.object ?? app.document ?? app.entity;
        const debugLogging = game.settings.get(
            MAESTRO.MODULE_NAME,
            MAESTRO.SETTINGS_KEYS.Misc.debugLogging
        );
        if (debugLogging && !actor) {
            console.debug("Maestro_pf2e | Hype button skip: no actor on app", {
                appName: app?.constructor?.name
            });
        }
        if(!game.user.isGM && !actor?.isOwner) {
            if (debugLogging) {
                console.debug("Maestro_pf2e | Hype button skip: no permission", {
                    actorId: actor?.id,
                    actorName: actor?.name
                });
            }
            return;
        }

        const enabled = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.HypeTrack.enable);

        if (!enabled) {
            if (debugLogging) {
                console.debug("Maestro_pf2e | Hype button skip: disabled");
            }
            return;
        }

        /**
         * Hype Button html literal
         * @todo replace with a template instead
         */
        const hypeButton = $(
            `<a class="${MAESTRO.DEFAULT_CONFIG.HypeTrack.name}" title="${MAESTRO.DEFAULT_CONFIG.HypeTrack.aTitle}">
                <i class="${MAESTRO.DEFAULT_CONFIG.HypeTrack.buttonIcon}"></i>
                <span> ${MAESTRO.DEFAULT_CONFIG.HypeTrack.buttonText}</span>
            </a>`
        );
        
        const $html = html instanceof HTMLElement ? $(html) : html;

        if ($html.find(`.${MAESTRO.DEFAULT_CONFIG.HypeTrack.name}`).length > 0) {
            if (debugLogging) {
                console.debug("Maestro_pf2e | Hype button exists, skipping");
            }
            return;
        }

        /**
         * Finds the header and the close button
         */
        const windowHeader = $html.find(".window-header");
        const windowCloseBtn = windowHeader.find(".close, .header-button.close");
    
        /**
         * Create an instance of the hypeButton before the close button
         */
        if (windowCloseBtn.length) {
            windowCloseBtn.first().before(hypeButton);
        } else {
            windowHeader.append(hypeButton);
        }

        if (debugLogging) {
            console.debug("Maestro_pf2e | Hype button added", {
                actorId: actor?.id,
                actorName: actor?.name
            });
        }
    
        /**
         * Register a click listener that opens the Hype Track form
         */
        hypeButton.click(ev => {
            const actorTrack = this._getActorHypeTrack(actor);
            this._openTrackForm(actor, actorTrack, {closeOnSubmit: true});
        });
    }
    
    /**
     * Opens the Hype Track form
     * @param {Object} actor  the actor object
     * @param {Object} track  any existing track for this actor
     * @param {Object} options  form options
     */
    _openTrackForm(actor, track, options){
        // Get playlist from actor flag, or fall back to default playlist
        const actorPlaylist = actor.getFlag(MAESTRO.MODULE_NAME, MAESTRO.DEFAULT_CONFIG.HypeTrack.flagNames.playlist) || this.playlist?.id || "";
        const data = {
            "track": track || "",
            "playlist": actorPlaylist
        }
        new HypeTrackActorForm(actor, data, options).render(true);
    }

    /**
     * Plays a hype track for the provided actor
     * @param {*} actor 
     */
    async playHype(actor, {warn=true, pauseOthers=false}={}) {
        if (typeof(actor) === "string") {
            actor = game.actors.getName(actor) || null;
        } else if (actor instanceof Object) {
            actor = game.actors.getName(actor.name) || null;
        }

        const debugLogging = game.settings.get(
            MAESTRO.MODULE_NAME,
            MAESTRO.SETTINGS_KEYS.Misc.debugLogging
        );

        if (!actor) {
            if (warn) ui.notifications.warn(game.i18n.localize("HYPE-TRACK.PlayHype.NoActor"));
            return;
        }

        const hypeTrack = this._getActorHypeTrack(actor);

        if (!hypeTrack) {
            if (warn) ui.notifications.warn(game.i18n.localize("HYPE-TRACK.PlayHype.NoTrack"));
            return;
        }

        const playlist = this.playlist || game.playlists.contents.find(p => p.name === MAESTRO.DEFAULT_CONFIG.HypeTrack.playlistName || p.sounds?.contents?.find(s => s._id === hypeTrack)) || null;

        if (!playlist) {
            if (warn) ui.notifications.warn(game.i18n.localize("HYPE-TRACK.PlayHype.NoPlaylist"));
        }

        if (playlist.playing) {
            await playlist.stopAll();
        }

        let pausedSounds = [];

        if (pauseOthers) {
            pausedSounds = Playback.pauseAll();
        }

        const playedTrack = await Playback.playTrack(hypeTrack, playlist.id);

        if (debugLogging) {
            console.debug("Maestro_pf2e | Hype playHype", {
                actorId: actor?.id,
                actorName: actor?.name,
                playlistId: playlist?.id,
                trackId: hypeTrack,
                playedTrackId: playedTrack?._id ?? playedTrack?.id
            });
        }

        if (pauseOthers && pausedSounds.length) {
            const playlistSound = playlist.sounds?.get(playedTrack._id) ?? playlist.sounds?.contents?.find(s => s._id === playedTrack._id);
            const soundInstance = playlistSound?.sound;
            if (!soundInstance) {
                return playedTrack;
            }

            if (typeof soundInstance.once === "function") {
                soundInstance.once("end", () => Playback.resumeSounds(pausedSounds));
            } else {
                soundInstance.on("end", () => Playback.resumeSounds(pausedSounds));
            }
        }

        return playedTrack;
    }
}

/**
 * A FormApplication for setting the Actor's Hype Track
 */
class HypeTrackActorForm extends FormApplication {
    constructor(actor, data, options){
        super(data, options);
        this.actor = actor;
        this.data = data;
    }
    
    /**
     * Default Options for this FormApplication
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "hype-track-form",
            title: MAESTRO.DEFAULT_CONFIG.HypeTrack.aTitle,
            classes: ["sheet"],
            width: 500
        });
    }

    /**
     * Build and return the HTML content directly (no Handlebars template)
     */
    async _renderInner(data) {
        // Get current form values if form is already rendered (to preserve user selections during re-render)
        let currentFormValues = {};
        if (this.element && this.element.length > 0) {
            const $form = this.element.find("form");
            if ($form.length > 0) {
                currentFormValues = {
                    playlist: $form.find("select[name='playlist']").val() || "",
                    track: $form.find("select[name='track']").val() || ""
                };
            }
        }

        // Use current form values if available, otherwise use saved data
        const currentPlaylist = currentFormValues.playlist || this.data.playlist || "";
        const currentTrack = currentFormValues.track || this.data.track || "";

        // Get playlists
        const playlists = game.playlists?.contents || [];
        
        // Get sounds for selected playlist
        const selectedPlaylist = currentPlaylist ? playlists.find(p => p.id === currentPlaylist) : null;
        const playlistSounds = selectedPlaylist?.sounds?.contents || [];

        // Build HTML
        let html = `<form autocomplete="off" onsubmit="event.preventDefault(); return false;">
            <div class="form-group">
                <label>Hype Playlist for this Actor</label>
                <select name="playlist" class="playlist-select">
                    <option value="" ${!currentPlaylist ? 'selected="selected"' : ''}>--None--</option>`;

        // Add playlist options
        for (const playlist of playlists) {
            const selected = playlist.id === currentPlaylist ? 'selected="selected"' : '';
            html += `\n                    <option value="${playlist.id}" ${selected}>${playlist.name}</option>`;
        }

        html += `
                </select>
                <p class="notes">Select the playlist that contains the Hype Track/s to play</p>
            </div>

            <div class="form-group">
                <label>Track to Play</label>
                <select name="track" class="track-select">
                    <option value="" ${!currentTrack ? 'selected="selected"' : ''}>--None--</option>`;

        if (playlistSounds.length > 0) {
            html += `\n                    <option value="random-track" ${currentTrack === "random-track" ? 'selected="selected"' : ''}>--Play Random Track--</option>`;
            html += `\n                    <option value="play-all" ${currentTrack === "play-all" ? 'selected="selected"' : ''}>--Play Playlist--</option>`;
            
            for (const sound of playlistSounds) {
                const soundId = sound.id ?? sound._id;
                const selected = soundId === currentTrack ? 'selected="selected"' : '';
                html += `\n                    <option value="${soundId}" ${selected}>${sound.name}</option>`;
            }
        }

        html += `
                </select>
                <p class="notes">Select the track or playback mode to use as this Actor's Hype Track</p>
            </div>

            <button type="submit" name="submit">
                <i class="far fa-save"></i> Save Changes
            </button>
        </form>`;

        return $(html);
    }

    /**
     * Executes on form submission.
     * Set the Hype Track flag on the specified Actor
     * @param {Object} event - the form submission event
     * @param {Object} formData - the form data
     */
    async _updateObject(event, formData) {
        const debugLogging = game.settings.get(
            MAESTRO.MODULE_NAME,
            MAESTRO.SETTINGS_KEYS.Misc.debugLogging
        );
        
        if (debugLogging) {
            console.log("Maestro_pf2e | Hype form submit", {
                actorId: this.actor?.id,
                track: formData.track,
                playlist: formData.playlist
            });
        }
        
        // Update this.data to reflect saved values
        this.data = {
            playlist: formData.playlist || "",
            track: formData.track || ""
        };
        
        // Set both playlist and track flags on the actor
        await game.maestro.hypeTrack._setActorHypeTrack(this.actor, formData.playlist, formData.track);
    }
    
    /**
     * Activate listeners for dynamic playlist/track selection
     */
    activateListeners(html) {
        super.activateListeners(html);
        const $html = html instanceof jQuery ? html : $(html);

        // Prevent form submission on Enter key or other default behaviors
        const form = $html.find("form");
        if (form.length > 0) {
            form.on("submit", (event) => {
                event.preventDefault();
                return false;
            });
        }
        
        // Update track options when playlist changes
        const playlistSelect = $html.find("select[name='playlist']");
        if (playlistSelect.length > 0) {
            playlistSelect.on("change", async (event) => {
                event.preventDefault();
                this.data.playlist = event.target.value;
                this.render();
            });
        }

        // Handle save button click explicitly
        const saveButton = $html.find("button[type='submit']");
        if (saveButton.length > 0) {
            saveButton.on("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();
                
                // Collect form data directly from select elements
                const formObject = {
                    playlist: $html.find("select[name='playlist']").val() || "",
                    track: $html.find("select[name='track']").val() || ""
                };
                
                await this._updateObject(event, formObject);
                this.close();
            });
        }
    }
}