import * as MAESTRO from "./config.js";
import * as Playback from "./playback.js";
import { bindTabs, createPlaylist, renderApplication, toElement } from "./foundry-compat.js";
import { hasControl, MaestroForm, PlaylistTrackFields } from "./forms.js";

/**
 * Attach a track or playlist to combat encounters that plays when the combat begins
 */
export default class CombatTrack {
    constructor() {
        this.playlist = null;
        this.pausedSounds = [];
    }

    /**
     * Checks for the presence of the Hype Tracks playlist, creates one if none exist
     */
    async _checkForCombatTracksPlaylist() {
        const enabled = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.enable);
        const createPlaylist = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.createPlaylist);

        if(!game.user.isGM || !enabled || !createPlaylist) {
            return;
        }

        const combatPlaylist = game.playlists.contents.find(p => p.name == MAESTRO.DEFAULT_CONFIG.CombatTrack.playlistName);
        if(!combatPlaylist) {
            this.playlist = await this._createCombatTracksPlaylist(true);
        } else {
            this.playlist = combatPlaylist;
        }
    }

    /**
     * Create the Hype Tracks playlist if the create param is true
     * @param {Boolean} create - whether or not to create the playlist
     */
    async _createCombatTracksPlaylist(create) {
        if (!create) {
            return;
        }
        return await createPlaylist({ name: MAESTRO.DEFAULT_CONFIG.CombatTrack.playlistName });
    }

    /**
     * Checks for the existence of a Combat Track and initiates playback
     * @param combat
     * @param update
     */
    async _checkCombatTrack(combat, update) {
        const combatStart = combat.round === 0 && update.round === 1;

        if (!game.user.isGM || !combatStart) {
            return;
        }

        const flags = CombatTrack.getCombatFlags(combat);
        const defaultPlaylist = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.defaultPlaylist);
        const defaultTrack = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.defaultTrack);

        if (!flags && !defaultPlaylist) {
            return;
        }

        const playlist = flags ? flags.playlist : defaultPlaylist ? defaultPlaylist : "";
        const track = flags ? flags.track : defaultTrack ? defaultTrack : "";

        if (!playlist) {
            return;
        }
        
        // Depending on the track flag determine how and what to play
        switch (track) {
            case MAESTRO.DEFAULT_CONFIG.CombatTrack.playbackModes.all:
                return await Playback.playPlaylist(playlist);
                
            
            case MAESTRO.DEFAULT_CONFIG.CombatTrack.playbackModes.random:
                return await Playback.playTrack(track, playlist);
        
            default:
                if (!track) {
                    break;
                }

                return await Playback.playTrack(track, playlist);     
        }
    }
    
    /**
     * Stops any playing combat tracks
     * @param {*} combat 
     */
    async _stopCombatTrack(combat) {
        const enabled = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.enable);
        if (!game.user.isGM || !enabled) {
            return;
        }

        const flags = CombatTrack.getCombatFlags(combat);
        const defaultPlaylist = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.defaultPlaylist);

        if (!flags && !defaultPlaylist) {
            return;
        }

        const playlistId = flags ? flags.playlist : defaultPlaylist ? defaultPlaylist : "";

        if (!playlistId) {
            return;
        }

        const playlist = game.playlists.get(playlistId);

        if (playlist.playing) {
            await playlist.stopAll();
            ui.playlists.render();
        }

        const playingSounds = playlist.sounds?.contents?.filter(s => s.playing) ?? [];
        const updates = playingSounds.map(s => {
            return {
                _id: s._id,
                playing: false
            }
        });

        if (updates.length) {
            await playlist.updateEmbeddedDocuments("PlaylistSound", updates);
        }
        ui.playlists.render();

        
    }

    /**
     * Gets the combat Track flags on an combat
     * @param {Object} combat - the combat to get flags from
     * @returns {Object} flags - an object containing the flags
     */
    static getCombatFlags(combat) {
        return combat.flags?.[MAESTRO.MODULE_NAME] ?? null;
    }

    /**
     * Sets the Combat Track flags on an Combat instance
     * Handled as an update so all flags can be set at once
     * @param {Object} combat - the combat to set flags on
     * @param {String} playlistId - the playlist id to set
     * @param {String} trackId - the trackId or playback mode to set
     */
    async setCombatFlags(combat, playlistId, trackId) {
        return await combat.update({
            [`flags.${MAESTRO.MODULE_NAME}.${MAESTRO.DEFAULT_CONFIG.CombatTrack.flagNames.playlist}`]: playlistId,
            [`flags.${MAESTRO.MODULE_NAME}.${MAESTRO.DEFAULT_CONFIG.CombatTrack.flagNames.track}`]: trackId
        });
    }
     
    /**
     * Adds a button to the Combat sheet to open the Combat Track form
     * @param {Object} app 
     * @param {Object} html 
     * @param {Object} data 
     */
    /**
     * Adds a Combat Track button next to the combat tracker settings control.
     * @param {Application} _app
     * @param {HTMLElement|JQuery} html
     * @param {object} [_data]
     */
    static async _addCombatTrackButton(_app, html, _data) {
        if (!game.user.isGM) {
            return;
        }

        const enabled = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.enable);
        if (!enabled || hasControl(html, MAESTRO.DEFAULT_CONFIG.CombatTrack.name)) {
            return;
        }

        const root = toElement(html);
        if (!root) {
            return;
        }

        const settingsButton = root.querySelector('[data-action="trackerSettings"], .combat-settings');
        const header = root.querySelector(".combat-tracker-header, #combat-round, header");
        if (!settingsButton && !header) {
            return;
        }

        const combatTrackButton = document.createElement("button");
        combatTrackButton.type = "button";
        combatTrackButton.className = `${MAESTRO.DEFAULT_CONFIG.CombatTrack.name} inline-control icon ${MAESTRO.DEFAULT_CONFIG.CombatTrack.buttonIcon}`;
        combatTrackButton.title = MAESTRO.DEFAULT_CONFIG.CombatTrack.aTitle;
        combatTrackButton.setAttribute("aria-label", MAESTRO.DEFAULT_CONFIG.CombatTrack.aTitle);

        if (settingsButton) {
            settingsButton.before(combatTrackButton);
        } else {
            header.append(combatTrackButton);
        }

        combatTrackButton.addEventListener("click", (event) => {
            event.preventDefault();
            const combat = game.combat || null;
            const flags = combat ? CombatTrack.getCombatFlags(combat) : null;
            CombatTrack._openTrackForm(combat, flags?.track ?? "", flags?.playlist ?? "");
        });
    }
    
    /**
     * Builds data object and opens the Combat Track form
     * @param {Object} combat - the reference combat
     * @param {String} track - any existing track
     * @param {Object} options - form options
     */
    /**
     * Builds data object and opens the Combat Track form.
     * @param {Combat|null} combat
     * @param {string} track
     * @param {string} playlist
     */
    static _openTrackForm(combat, track, playlist){
        renderApplication(new CombatTrackForm({
            combat,
            data: {
                defaultPlaylist: game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.defaultPlaylist),
                defaultTrack: game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.defaultTrack),
                currentTrack: track,
                currentPlaylist: playlist
            }
        }));
    }
    
    /**
     * 
     * @param {*} defaults 
     */
    async _setDefaultCombatTrack(defaults) {
        await game.settings.set(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.defaultPlaylist, defaults.playlist);
        await game.settings.set(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.defaultTrack, defaults.track);
    }
}

/**
 * ApplicationV2 form for managing combat track defaults and the active encounter.
 */
class CombatTrackForm extends MaestroForm {
    static DEFAULT_OPTIONS = {
        id: "combat-track-form",
        window: {
            title: MAESTRO.DEFAULT_CONFIG.CombatTrack.aTitle,
            icon: "fas fa-swords"
        }
    };

    /**
     * @param {object} [options]
     * @param {Combat|null} [options.combat]
     * @param {object} [options.data]
     */
    constructor(options = {}) {
        super(options);
        this.combat = options.combat ?? null;
        this.data = options.data ?? {};
        this._sheetTab = this.combat ? "encounter" : "defaults";
    }

    /**
     * @returns {object}
     */
    async _prepareContext() {
        return {
            combat: this.combat,
            defaultPlaylist: this._getFieldValue("default-playlist") || this.data.defaultPlaylist || "",
            defaultTrack: this._getFieldValue("default-track") || this.data.defaultTrack || "",
            playlist: this._getFieldValue("playlist") || this.data.currentPlaylist || "default",
            track: this._getFieldValue("track") || this.data.currentTrack || "default"
        };
    }

    /**
     * @param {object} context
     * @returns {string}
     */
    _buildFormHTML(context) {
        const defaultsTab = PlaylistTrackFields.render({
            playlistName: "default-playlist",
            trackName: "default-track",
            playlistLabel: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormDefaultPlaylistLabel"),
            trackLabel: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormDefaultTrackLabel"),
            playlistNotes: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormDefaultPlaylistNotes"),
            trackNotes: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormDefaultTrackNotes"),
            playlistValue: context.defaultPlaylist,
            trackValue: context.defaultTrack,
            extraPlaylistOptions: [{ value: "", label: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormSelectNone") }]
        });

        const encounterTab = this.combat ? PlaylistTrackFields.render({
            playlistName: "playlist",
            trackName: "track",
            playlistLabel: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormPlaylistLabel"),
            trackLabel: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormTrackLabel"),
            playlistNotes: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormPlaylistNotes"),
            trackNotes: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormTrackNotes"),
            playlistValue: context.playlist,
            trackValue: context.track,
            extraPlaylistOptions: [
                { value: "default", label: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormSelectUseDefault") },
                { value: "", label: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormSelectNone") }
            ],
            extraTrackOptions: [
                { value: "default", label: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormSelectUseDefault") },
                { value: "", label: game.i18n.localize("MAESTRO.COMBAT-TRACK.FormSelectNone") }
            ]
        }) : "";

        return `
            <nav class="sheet-tabs tabs" data-group="primary">
                <a class="item${this._sheetTab === "defaults" ? " active" : ""}" data-tab="defaults" data-group="primary">
                    <i class="fas fa-cog"></i> ${game.i18n.localize("MAESTRO.COMBAT-TRACK.FormDefaultsHeading")}
                </a>
                ${this.combat ? `
                <a class="item${this._sheetTab === "encounter" ? " active" : ""}" data-tab="encounter" data-group="primary">
                    <i class="fas fa-fist-raised"></i> ${game.i18n.localize("MAESTRO.COMBAT-TRACK.FormEncounterHeading")}
                </a>` : ""}
            </nav>
            <section class="content">
                <div class="tab defaults flexcol${this._sheetTab === "defaults" ? " active" : ""}" data-group="primary" data-tab="defaults">
                    ${defaultsTab}
                </div>
                ${this.combat ? `
                <div class="tab encounter flexcol${this._sheetTab === "encounter" ? " active" : ""}" data-group="primary" data-tab="encounter">
                    ${encounterTab}
                </div>` : ""}
            </section>
            <button type="submit" name="submit">
                <i class="far fa-save"></i> Save
            </button>
        `;
    }

    /**
     * Bind tabs and refresh track lists when a playlist select changes.
     * @param {object} context
     * @param {object} options
     */
    async _onRender(context, options) {
        await super._onRender?.(context, options);
        bindTabs(this.element, { initial: this._sheetTab });
        this.element.querySelector("select[name='default-playlist']")?.addEventListener("change", (event) => {
            this.data.defaultPlaylist = event.target.value;
            this.data.defaultTrack = "";
            this._sheetTab = "defaults";
            this.render();
        });
        this.element.querySelector("select[name='playlist']")?.addEventListener("change", (event) => {
            this.data.currentPlaylist = event.target.value;
            this.data.currentTrack = "";
            this._sheetTab = "encounter";
            this.render();
        });
    }

    /**
     * Save default combat-track settings and optional encounter flags.
     * @param {Event} _event
     * @param {object} formData
     */
    async _onSubmitForm(_event, formData) {
        await game.settings.set(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.defaultPlaylist, formData["default-playlist"] || "");
        await game.settings.set(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.CombatTrack.defaultTrack, formData["default-track"] || "");

        if (!this.combat) {
            return;
        }
        if (formData.playlist === "default" && formData.track === "default") {
            return;
        }
        const playlist = formData.playlist === "default" ? this.data.defaultPlaylist : formData.playlist;
        await game.maestro.combatTrack.setCombatFlags(this.combat, playlist, formData.track);
    }
}