import * as MAESTRO from "./config.js";
import * as Playback from "./playback.js";
import { createPlaylist, getSheetDocument, insertHeaderControl, renderApplication, toElement } from "./foundry-compat.js";
import { createControlButton, hasControl, MaestroForm, PlaylistTrackFields } from "./forms.js";

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
            return await createPlaylist({ name: MAESTRO.DEFAULT_CONFIG.HypeTrack.playlistName });
        } else {
            return;
        }
    }

    /**
     * Checks for the existence of the Hype Track actor flag, then plays the track.
     * When "Pause Other Playlist Sounds" is enabled, other playlist audio is paused and
     * resumed from its paused position after the hype track finishes (or immediately if
     * the combatant has no hype track).
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

        // Keep previously paused sounds across consecutive hype turns; pauseAll only sees playing sounds
        if (pauseOthers) {
            if (!this.pausedSounds?.length) {
                this.pausedSounds = Playback.pauseAll() || [];
            }
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

        if (!this.pausedSounds?.length) {
            if (debugLogging) {
                console.log("Maestro_pf2e | Hype: no paused sounds to resume, track should be playing");
            }
            return;
        }

        const playlistSoundDoc = this.playlist.sounds?.get(hypeTrack)
            ?? this.playlist.sounds?.contents?.find(s => s._id === hypeTrack)
            ?? hypeTrackSound;

        if (!playlistSoundDoc?.sound) {
            Playback.resumeSounds(this.pausedSounds);
            this.pausedSounds = [];
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

        // Resume background music from its paused position when the hype track ends
        Playback.attachResumeWhenSoundEnds(playlistSoundDoc, this.pausedSounds, () => {
            this.pausedSounds = [];
        });

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
     * Adds a Hype button to an actor sheet header (Application V1 or V2).
     * @param {Application} app
     * @param {HTMLElement|JQuery} html
     * @param {object} [_data]
     */
    async _addHypeButton (app, html, _data) {
        const actor = getSheetDocument(app);
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

        if (hasControl(html, MAESTRO.DEFAULT_CONFIG.HypeTrack.name)) {
            if (debugLogging) {
                console.debug("Maestro_pf2e | Hype button exists, skipping");
            }
            return;
        }

        const hypeButton = createControlButton({
            className: `${MAESTRO.DEFAULT_CONFIG.HypeTrack.name} header-control`,
            title: MAESTRO.DEFAULT_CONFIG.HypeTrack.aTitle,
            icon: MAESTRO.DEFAULT_CONFIG.HypeTrack.buttonIcon,
            text: MAESTRO.DEFAULT_CONFIG.HypeTrack.buttonText,
            tag: "a"
        });

        if (!insertHeaderControl([toElement(html), app?.element], hypeButton)) {
            if (debugLogging) {
                console.debug("Maestro_pf2e | Hype button skip: no window header");
            }
            return;
        }

        if (debugLogging) {
            console.debug("Maestro_pf2e | Hype button added", {
                actorId: actor?.id,
                actorName: actor?.name
            });
        }

        hypeButton.addEventListener("click", (event) => {
            event.preventDefault();
            const actorTrack = this._getActorHypeTrack(actor);
            this._openTrackForm(actor, actorTrack);
        });
    }

    /**
     * Add an ApplicationV2 header-control entry for Hype Track.
     * @param {Application} app
     * @param {Array<object>} controls
     */
    addHypeHeaderControl(app, controls) {
        const actor = getSheetDocument(app);
        const enabled = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.HypeTrack.enable);
        if (!enabled || !actor || actor.documentName !== "Actor") {
            return;
        }
        if (!game.user.isGM && !actor.isOwner) {
            return;
        }
        if (controls.some((control) => control.action === "maestroHypeTrack")) {
            return;
        }
        controls.push({
            icon: MAESTRO.DEFAULT_CONFIG.HypeTrack.buttonIcon,
            label: MAESTRO.DEFAULT_CONFIG.HypeTrack.aTitle,
            action: "maestroHypeTrack",
            onClick: () => {
                this._openTrackForm(actor, this._getActorHypeTrack(actor));
            }
        });
    }
    
    /**
     * Opens the Hype Track form
     * @param {Object} actor  the actor object
     * @param {Object} track  any existing track for this actor
     * @param {Object} options  form options
     */
    /**
     * Opens the Hype Track form.
     * @param {Actor} actor
     * @param {string} track
     */
    _openTrackForm(actor, track){
        const actorPlaylist = actor.getFlag(MAESTRO.MODULE_NAME, MAESTRO.DEFAULT_CONFIG.HypeTrack.flagNames.playlist) || this.playlist?.id || "";
        renderApplication(new HypeTrackActorForm({
            actor,
            data: {
                track: track || "",
                playlist: actorPlaylist
            }
        }));
    }

    /**
     * Plays a hype track for the provided actor.
     * When pauseOthers is true, other playlist sounds are paused and resumed from their
     * paused position after the hype track ends.
     * @param {*} actor
     * @param {Object} [options]
     * @param {boolean} [options.warn=true] - show warnings when actor/track/playlist is missing
     * @param {boolean} [options.pauseOthers=false] - pause other playing playlist sounds until hype ends
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
            const playlistSound = playlist.sounds?.get(playedTrack._id)
                ?? playlist.sounds?.contents?.find(s => s._id === playedTrack._id || s.id === playedTrack._id);
            Playback.attachResumeWhenSoundEnds(playlistSound, pausedSounds);
        }

        return playedTrack;
    }
}

/**
 * ApplicationV2 form for setting an Actor's Hype Track.
 */
class HypeTrackActorForm extends MaestroForm {
    static DEFAULT_OPTIONS = {
        id: "hype-track-form",
        window: {
            title: MAESTRO.DEFAULT_CONFIG.HypeTrack.aTitle,
            icon: "fas fa-music"
        }
    };

    /**
     * @param {object} [options]
     * @param {Actor} [options.actor]
     * @param {{playlist?: string, track?: string}} [options.data]
     */
    constructor(options = {}) {
        super(options);
        this.actor = options.actor ?? null;
        this.data = options.data ?? { playlist: "", track: "" };
    }

    /**
     * @returns {object}
     */
    async _prepareContext() {
        return {
            playlist: this._getFieldValue("playlist") || this.data.playlist || "",
            track: this._getFieldValue("track") || this.data.track || ""
        };
    }

    /**
     * @param {object} context
     * @returns {string}
     */
    _buildFormHTML(context) {
        return `
            ${PlaylistTrackFields.render({
                playlistName: "playlist",
                trackName: "track",
                playlistLabel: game.i18n.localize("MAESTRO.HYPE-TRACK.Form.PlaylistLabel"),
                trackLabel: game.i18n.localize("MAESTRO.HYPE-TRACK.Form.TrackLabel"),
                playlistNotes: game.i18n.localize("MAESTRO.HYPE-TRACK.FormPlaylistNotes"),
                trackNotes: game.i18n.localize("MAESTRO.HYPE-TRACK.FormTrackNotes"),
                playlistValue: context.playlist,
                trackValue: context.track
            })}
            <button type="submit" name="submit">
                <i class="far fa-save"></i> ${game.i18n.localize("MAESTRO.HYPE-TRACK.FormSaveTrack")}
            </button>
        `;
    }

    /**
     * Re-render track options when the playlist changes.
     * @param {object} context
     * @param {object} options
     */
    async _onRender(context, options) {
        await super._onRender?.(context, options);
        this.element.querySelector("select[name='playlist']")?.addEventListener("change", (event) => {
            this.data.playlist = event.target.value;
            this.data.track = "";
            this.render();
        });
    }

    /**
     * Save playlist and track flags on the actor.
     * @param {Event} _event
     * @param {object} formData
     */
    async _onSubmitForm(_event, formData) {
        const debugLogging = game.settings.get(
            MAESTRO.MODULE_NAME,
            MAESTRO.SETTINGS_KEYS.Misc.debugLogging
        );
        this.data = {
            playlist: formData.playlist || "",
            track: formData.track || ""
        };
        if (debugLogging) {
            console.log("Maestro_pf2e | Hype form submit", {
                actorId: this.actor?.id,
                ...this.data
            });
        }
        await game.maestro.hypeTrack._setActorHypeTrack(this.actor, this.data.playlist, this.data.track);
    }
}