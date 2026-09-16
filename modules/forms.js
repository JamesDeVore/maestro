import { escapeHtml, renderSelectOptions, toElement } from "./foundry-compat.js";

/**
 * Resolve ApplicationV2 without throwing if Foundry's namespace is not ready yet.
 * @returns {typeof foundry.applications.api.ApplicationV2}
 */
function resolveApplicationV2() {
    return foundry?.applications?.api?.ApplicationV2
        ?? foundry?.applications?.api?.Application
        ?? globalThis.foundry?.applications?.api?.ApplicationV2
        ?? null;
}

const ApplicationV2 = resolveApplicationV2() ?? class ApplicationV2Unavailable {
    static DEFAULT_OPTIONS = {};

    /**
     * @param {object} [options]
     */
    constructor(options = {}) {
        this.options = options;
    }

    /**
     * @returns {Promise<this>}
     */
    async render() {
        console.error("Maestro_pf2e | ApplicationV2 is not available; cannot open this form");
        return this;
    }

    /**
     * @returns {Promise<this>}
     */
    async close() {
        return this;
    }
};

/**
 * Shared ApplicationV2 form used by Maestro config windows.
 * Builds inner HTML in subclasses so the module no longer depends on the
 * Handlebars `{{#select}}` helper removed in Foundry v14.
 */
export class MaestroForm extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
        tag: "form",
        classes: ["maestro-form"],
        position: { width: 500 },
        window: {
            contentClasses: ["standard-form"]
        },
        form: {
            handler: MaestroForm.#onSubmit,
            closeOnSubmit: true,
            submitOnChange: false
        }
    };

    /**
     * ApplicationV2 form submission handler.
     * @this {MaestroForm}
     * @param {SubmitEvent|Event} event
     * @param {HTMLFormElement} form
     * @param {foundry.applications.ux.FormDataExtended} formData
     */
    static async #onSubmit(event, form, formData) {
        await this._onSubmitForm(event, formData.object ?? {});
    }

    /**
     * Persist form values. Override in subclasses.
     * @param {SubmitEvent|Event} _event
     * @param {object} _formData
     * @returns {Promise<void>}
     */
    async _onSubmitForm(_event, _formData) {}

    /**
     * Build the inner form HTML. Override in subclasses.
     * The Application frame is already a `<form>`, so do not wrap this in another form tag.
     * @param {object} _context
     * @returns {string}
     */
    _buildFormHTML(_context) {
        return "";
    }

    /**
     * Render inner HTML for ApplicationV2.
     * @param {object} context
     * @param {object} _options
     * @returns {Promise<HTMLElement>}
     */
    async _renderHTML(context, _options) {
        const wrapper = document.createElement("div");
        wrapper.className = "maestro-form-body";
        wrapper.innerHTML = this._buildFormHTML(context);
        return wrapper;
    }

    /**
     * Replace the window content with the rendered form body.
     * @param {HTMLElement} result
     * @param {HTMLElement} content
     * @param {object} _options
     */
    _replaceHTML(result, content, _options) {
        content.replaceChildren(...result.childNodes);
    }

    /**
     * Read a named field from the currently rendered form.
     * @param {string} name
     * @returns {string}
     */
    _getFieldValue(name) {
        const field = this.element?.querySelector(`[name="${name}"]`);
        return field?.value ?? "";
    }
}

/**
 * Playlist + optional playback-mode/track `<select>` pair used by Maestro forms.
 */
export class PlaylistTrackFields {
    /**
     * Map world playlists to select choices.
     * @returns {Array<{value: string, label: string}>}
     */
    static playlistChoices() {
        return (game.playlists?.contents ?? []).map((playlist) => ({
            value: playlist.id,
            label: playlist.name
        }));
    }

    /**
     * Map a playlist's sounds to select choices.
     * @param {string} playlistId
     * @returns {Array<{value: string, label: string}>}
     */
    static soundChoices(playlistId) {
        if (!playlistId) {
            return [];
        }
        const playlist = game.playlists.get(playlistId);
        return (playlist?.sounds?.contents ?? []).map((sound) => ({
            value: sound.id ?? sound._id,
            label: sound.name
        }));
    }

    /**
     * Render a labeled playlist select plus a track/mode select.
     * @param {object} config
     * @param {string} config.playlistName
     * @param {string} config.trackName
     * @param {string} config.playlistLabel
     * @param {string} config.trackLabel
     * @param {string} [config.playlistNotes]
     * @param {string} [config.trackNotes]
     * @param {string} [config.playlistValue]
     * @param {string} [config.trackValue]
     * @param {Array<{value: string, label: string}>} [config.extraPlaylistOptions]
     * @param {Array<{value: string, label: string}>} [config.extraTrackOptions]
     * @param {boolean} [config.includePlaybackModes=true]
     * @param {string} [config.noneLabel]
     * @returns {string}
     */
    static render({
        playlistName,
        trackName,
        playlistLabel,
        trackLabel,
        playlistNotes = "",
        trackNotes = "",
        playlistValue = "",
        trackValue = "",
        extraPlaylistOptions = [],
        extraTrackOptions = [],
        includePlaybackModes = true,
        noneLabel
    }) {
        const resolvedNone = noneLabel
            ?? game.i18n?.localize?.("MAESTRO.FORM.SelectNone")
            ?? "--None--";
        const playlistChoices = extraPlaylistOptions.length
            ? [...extraPlaylistOptions, ...PlaylistTrackFields.playlistChoices()]
            : [{ value: "", label: resolvedNone }, ...PlaylistTrackFields.playlistChoices()];
        const soundChoices = PlaylistTrackFields.soundChoices(playlistValue);
        const trackChoices = extraTrackOptions.length
            ? [...extraTrackOptions]
            : [{ value: "", label: resolvedNone }];

        if (includePlaybackModes && soundChoices.length) {
            trackChoices.push(
                { value: "random-track", label: game.i18n?.localize?.("MAESTRO.FORM.PlayRandom") ?? "--Play Random Track--" },
                { value: "play-all", label: game.i18n?.localize?.("MAESTRO.FORM.PlayAll") ?? "--Play Playlist--" }
            );
        }
        trackChoices.push(...soundChoices);

        return `
            <div class="form-group">
                <label>${escapeHtml(playlistLabel)}</label>
                <select name="${escapeHtml(playlistName)}" class="playlist-select">
                    ${renderSelectOptions(playlistChoices, playlistValue)}
                </select>
                ${playlistNotes ? `<p class="notes">${escapeHtml(playlistNotes)}</p>` : ""}
            </div>
            <div class="form-group">
                <label>${escapeHtml(trackLabel)}</label>
                <select name="${escapeHtml(trackName)}" class="track-select">
                    ${renderSelectOptions(trackChoices, trackValue)}
                </select>
                ${trackNotes ? `<p class="notes">${escapeHtml(trackNotes)}</p>` : ""}
            </div>
        `;
    }
}

/**
 * Create an ApplicationV2-safe header/sidebar control button.
 * @param {object} config
 * @param {string} config.className
 * @param {string} config.title
 * @param {string} config.icon
 * @param {string} [config.text]
 * @param {string} [config.tag="button"]
 * @returns {HTMLElement}
 */
export function createControlButton({ className, title, icon, text = "", tag = "button" }) {
    const button = document.createElement(tag);
    button.className = className;
    button.title = title;
    if (tag === "button") {
        button.type = "button";
    }
    const iconEl = document.createElement("i");
    iconEl.className = icon;
    button.append(iconEl);
    if (text) {
        const label = document.createElement("span");
        label.textContent = ` ${text}`;
        button.append(label);
    }
    return button;
}

/**
 * Return true if a control with the given class already exists under root.
 * @param {HTMLElement|JQuery} html
 * @param {string} className
 * @returns {boolean}
 */
export function hasControl(html, className) {
    const root = toElement(html);
    return Boolean(root?.querySelector(`.${className}`));
}
