import * as MAESTRO from "./config.js";
import * as Playback from "./playback.js";
import { createPlaylist, getActorItem, getSheetDocument, insertHeaderControl, renderApplication, toElement } from "./foundry-compat.js";
import { createControlButton, hasControl, MaestroForm, PlaylistTrackFields } from "./forms.js";

/**
 * Attach a track to an item that plays when the item is rolled
 */
export default class ItemTrack {
    constructor() {
        this.playlist = null;
    }

    /**
     * Checks for the presence of the Hype Tracks playlist, creates one if none exist
     */
    async _checkForItemTracksPlaylist() {
        const enabled = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.ItemTrack.enable);
        const createPlaylist = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.ItemTrack.createPlaylist);

        if(!game.user.isGM || !enabled || !createPlaylist) {
            return;
        }

        const itemPlaylist = game.playlists.contents.find(p => p.name == MAESTRO.DEFAULT_CONFIG.ItemTrack.playlistName);
        if(!itemPlaylist) {
            this.playlist = await this._createItemTracksPlaylist(true);
        } else {
            this.playlist = itemPlaylist;
        }
    }

    /**
     * Create the Hype Tracks playlist if the create param is true
     * @param {Boolean} create - whether or not to create the playlist
     */
    async _createItemTracksPlaylist(create) {
        if (!create) {
            return;
        }
        return await createPlaylist({ name: MAESTRO.DEFAULT_CONFIG.ItemTrack.playlistName });
    }

    /**
     * Handles module logic for chat message card
     * @param {Object} message - the chat message object
     * @param {Object} html - the jquery object
     * @param {Object} data - the data in the message update
     */
    /**
     * Play an item track when a chat card for that item is rendered.
     * @param {foundry.documents.ChatMessage} message
     * @param {HTMLElement|JQuery} html
     * @param {object} [_data]
     */
    async chatMessageHandler(message, html, _data) {
        const enabled = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.ItemTrack.enable);
        if (!enabled || !game.user.isGM) {
            return;
        }

        const root = toElement(html);
        const itemCard = root?.querySelector("[data-item-id]");
        const trackPlayed = message.getFlag(MAESTRO.MODULE_NAME, MAESTRO.DEFAULT_CONFIG.ItemTrack.flagNames.played);
        
        if(!itemCard || trackPlayed) {
            return;
        }
        
        let item;
        const itemId = itemCard.getAttribute("data-item-id");
        const actorId = itemCard.getAttribute("data-actor-id");
        const sceneTokenId = itemCard.getAttribute("data-token-id");

        if (sceneTokenId) {
            const tokenId = sceneTokenId.includes(".") ? sceneTokenId.split(".").pop() : sceneTokenId;
            const token = canvas.tokens.get(tokenId);
            item = getActorItem(token?.actor, itemId);
        } else if (actorId) {
            item = getActorItem(game.actors.get(actorId), itemId);
        } else {
            item = game.items.get(itemId);
        }

        const flags = await this.getItemFlags(item);

        if (!flags) {
            return;
        }

        const track = flags.track || "";
        const playlist = flags.playlist || "";

        // Depending on the track flag determine how and what to play
        switch (track) {
            case MAESTRO.DEFAULT_CONFIG.ItemTrack.playbackModes.all:
                await Playback.playPlaylist(playlist);
                return this._setChatMessageFlag(message);
            
            case MAESTRO.DEFAULT_CONFIG.ItemTrack.playbackModes.random:
                await Playback.playTrack(track, playlist)
                return this._setChatMessageFlag(message);
        
            default:
                if (!track) {
                    break;
                }

                await Playback.playTrack(track, playlist);
                return this._setChatMessageFlag(message);      
        }
    }    

    /**
     * Gets the Item Track flags on an Item
     * @param {Object} item - the item to get flags from
     * @returns {Promise} flags - an object containing the flags
     */
    /**
     * Gets the Item Track flags on an Item.
     * @param {Item|null|undefined} item
     * @returns {Promise<object|null>}
     */
    async getItemFlags(item) {
        if (!item) {
            return null;
        }
        return item.flags?.[MAESTRO.MODULE_NAME] ?? null;
    }

    /**
     * Sets the Item Track flags on an Item instance
     * Handled as an update so all flags can be set at once
     * @param {Object} item - the item to set flags on
     * @param {String} playlistId - the playlist id to set
     * @param {String} trackId - the trackId or playback mode to set
     */
    async setItemFlags(item, playlistId, trackId) {
        return await item.update({
            [`flags.${MAESTRO.MODULE_NAME}.${MAESTRO.DEFAULT_CONFIG.ItemTrack.flagNames.playlist}`]: playlistId,
            [`flags.${MAESTRO.MODULE_NAME}.${MAESTRO.DEFAULT_CONFIG.ItemTrack.flagNames.track}`]: trackId
        });
    }
     
    /**
     * Adds a button to the Item sheet to open the Item Track form
     * @param {Object} app 
     * @param {Object} html 
     * @param {Object} data 
     */
    /**
     * Adds an Item Track button to an item sheet header.
     * @param {Application} app
     * @param {HTMLElement|JQuery} html
     * @param {object} [_data]
     */
    async _addItemTrackButton (app, html, _data) {
        const enabled = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.ItemTrack.enable);
        if (!enabled || app.isEditable === false) {
            return;
        }

        if (hasControl(html, MAESTRO.DEFAULT_CONFIG.ItemTrack.name)) {
            return;
        }

        const itemTrackButton = createControlButton({
            className: `${MAESTRO.DEFAULT_CONFIG.ItemTrack.name} header-control`,
            title: MAESTRO.DEFAULT_CONFIG.ItemTrack.aTitle,
            icon: MAESTRO.DEFAULT_CONFIG.ItemTrack.buttonIcon,
            text: MAESTRO.DEFAULT_CONFIG.ItemTrack.buttonText,
            tag: "a"
        });

        if (!insertHeaderControl([toElement(html), app?.element], itemTrackButton)) {
            return;
        }

        itemTrackButton.addEventListener("click", async (event) => {
            event.preventDefault();
            const item = getSheetDocument(app);
            const flags = await this.getItemFlags(item);
            this._openTrackForm(item, flags?.track ?? "", flags?.playlist ?? "");
        });
    }

    /**
     * Add an ApplicationV2 header-control entry for Item Track.
     * @param {Application} app
     * @param {Array<object>} controls
     */
    addItemHeaderControl(app, controls) {
        const item = getSheetDocument(app);
        const enabled = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.ItemTrack.enable);
        if (!enabled || !item || item.documentName !== "Item" || app.isEditable === false) {
            return;
        }
        if (!game.user.isGM) {
            return;
        }
        if (controls.some((control) => control.action === "maestroItemTrack")) {
            return;
        }
        controls.push({
            icon: MAESTRO.DEFAULT_CONFIG.ItemTrack.buttonIcon,
            label: MAESTRO.DEFAULT_CONFIG.ItemTrack.aTitle,
            action: "maestroItemTrack",
            onClick: async () => {
                const flags = await this.getItemFlags(item);
                this._openTrackForm(item, flags?.track ?? "", flags?.playlist ?? "");
            }
        });
    }
    
    /**
     * Builds data object and opens the Item Track form
     * @param {Object} item - the reference item
     * @param {String} track - any existing track
     * @param {Object} options - form options
     */
    /**
     * Builds data object and opens the Item Track form.
     * @param {Item} item
     * @param {string} track
     * @param {string} playlist
     */
    _openTrackForm(item, track, playlist){
        renderApplication(new ItemTrackForm({
            item,
            data: {
                currentTrack: track,
                currentPlaylist: playlist
            }
        }));
    }    

    /**
     * Sets a flag on a chat message
     * @param {Object} message - the message to set a flag on
     */
    _setChatMessageFlag(message) {
        if (!message) {
            return;
        }

        message.setFlag(MAESTRO.MODULE_NAME, MAESTRO.DEFAULT_CONFIG.ItemTrack.flagNames.played, true);
    }    
}

/**
 * ApplicationV2 form for managing an item's track.
 */
class ItemTrackForm extends MaestroForm {
    static DEFAULT_OPTIONS = {
        id: "item-track-form",
        window: {
            title: MAESTRO.DEFAULT_CONFIG.ItemTrack.aTitle,
            icon: "fas fa-music"
        }
    };

    /**
     * @param {object} [options]
     * @param {Item} [options.item]
     * @param {{currentPlaylist?: string, currentTrack?: string}} [options.data]
     */
    constructor(options = {}) {
        super(options);
        this.item = options.item ?? null;
        this.data = options.data ?? { currentPlaylist: "", currentTrack: "" };
    }

    /**
     * @returns {object}
     */
    async _prepareContext() {
        return {
            playlist: this._getFieldValue("playlist") || this.data.currentPlaylist || "",
            track: this._getFieldValue("track") || this.data.currentTrack || ""
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
                playlistLabel: "Item Playlist",
                trackLabel: "Item Track",
                playlistNotes: game.i18n.localize("MAESTRO.ITEM-TRACK.FormPlaylistNotes"),
                trackNotes: game.i18n.localize("MAESTRO.ITEM-TRACK.FormTrackNotes"),
                playlistValue: context.playlist,
                trackValue: context.track
            })}
            <button type="submit">
                <i class="far fa-save"></i> ${game.i18n.localize("MAESTRO.FORM.SaveTrack")}
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
            this.data.currentPlaylist = event.target.value;
            this.data.currentTrack = "";
            this.render();
        });
    }

    /**
     * Save playlist and track flags on the item.
     * @param {Event} _event
     * @param {object} formData
     */
    async _persistFormData(_event, formData) {
        this.data.currentPlaylist = formData.playlist || "";
        this.data.currentTrack = formData.track || "";
        await game.maestro.itemTrack.setItemFlags(this.item, this.data.currentPlaylist, this.data.currentTrack);
    }
}