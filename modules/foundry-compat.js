/**
 * Foundry VTT v13/v14 compatibility helpers.
 * ApplicationV2 sidebars and sheets pass HTMLElements, document globals moved
 * under foundry.documents, and several v12 Handlebars/document shims were removed in v14.
 */

/**
 * Return the Playlist document class for the current Foundry generation.
 * @returns {typeof foundry.documents.Playlist}
 */
export function getPlaylistDocument() {
    return foundry.documents?.Playlist ?? globalThis.Playlist;
}

/**
 * Create a world Playlist document.
 * @param {object} data - Playlist creation data
 * @returns {Promise<foundry.documents.Playlist>}
 */
export async function createPlaylist(data) {
    return getPlaylistDocument().create(data);
}

/**
 * Normalize a hook/app HTML argument to an HTMLElement.
 * @param {HTMLElement|JQuery|string|null|undefined} html
 * @returns {HTMLElement|null}
 */
export function toElement(html) {
    if (!html) {
        return null;
    }
    if (html instanceof HTMLElement) {
        return html;
    }
    if (typeof html === "string") {
        const template = document.createElement("template");
        template.innerHTML = html.trim();
        return template.content.firstElementChild;
    }
    if (html instanceof jQuery || (typeof html.get === "function" && html[0])) {
        return html[0] ?? null;
    }
    return null;
}

/**
 * Escape text for interpolation into generated HTML.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
    const text = value == null ? "" : String(value);
    const span = document.createElement("span");
    span.textContent = text;
    return span.innerHTML;
}

/**
 * Build `<option>` markup for a select, marking the current value.
 * @param {Array<{value: string, label: string}>} choices
 * @param {string} [selected=""]
 * @returns {string}
 */
export function renderSelectOptions(choices, selected = "") {
    return (choices ?? []).map((choice) => {
        const isSelected = String(choice.value) === String(selected);
        return `<option value="${escapeHtml(choice.value)}"${isSelected ? " selected" : ""}>${escapeHtml(choice.label)}</option>`;
    }).join("");
}

/**
 * Resolve the document from an actor/item sheet application.
 * @param {*} app
 * @returns {foundry.abstract.Document|null}
 */
export function getSheetDocument(app) {
    return app?.document ?? app?.actor ?? app?.item ?? app?.object ?? app?.entity ?? null;
}

/**
 * Get an owned item from an actor without using removed `getOwnedItem`.
 * @param {Actor|null|undefined} actor
 * @param {string} itemId
 * @returns {Item|null}
 */
export function getActorItem(actor, itemId) {
    if (!actor || !itemId) {
        return null;
    }
    return actor.items?.get(itemId) ?? actor.getEmbeddedDocument?.("Item", itemId) ?? null;
}

/**
 * Insert a node before the window close control, or append it to the header.
 * Supports Application V1 (`.close`) and ApplicationV2 (`[data-action="close"]`) headers.
 * @param {HTMLElement|HTMLElement[]|null|undefined} root
 * @param {HTMLElement} node
 * @returns {boolean} whether the node was inserted
 */
export function insertHeaderControl(root, node) {
    const roots = (Array.isArray(root) ? root : [root])
        .map((entry) => toElement(entry))
        .filter(Boolean);
    for (const candidate of roots) {
        const header = candidate.querySelector?.(".window-header") ?? (candidate.classList?.contains("window-header") ? candidate : null);
        if (!header) {
            continue;
        }
        const closeBtn = header.querySelector('[data-action="close"], .header-control[data-action="close"], .close, .header-button.close');
        if (closeBtn) {
            closeBtn.before(node);
        } else {
            header.append(node);
        }
        return true;
    }
    return false;
}

/**
 * Open an Application (V1 or V2). ApplicationV2 prefers `{ force: true }`.
 * @param {*} app
 * @returns {Promise<*>|*}
 */
export function renderApplication(app) {
    if (!app) {
        return;
    }
    if (typeof app.render === "function") {
        return app.render({ force: true });
    }
    return app;
}

/**
 * Return the Tabs controller class for the current Foundry generation.
 * @returns {typeof foundry.applications.ux.Tabs|undefined}
 */
export function getTabsClass() {
    return foundry.applications?.ux?.Tabs ?? globalThis.Tabs;
}

/**
 * Bind Foundry tab navigation to an ApplicationV2 element.
 * @param {HTMLElement} root
 * @param {object} [config]
 * @param {string} [config.initial]
 * @param {string} [config.navSelector=".tabs"]
 * @param {string} [config.contentSelector=".content"]
 */
export function bindTabs(root, { initial, navSelector = ".tabs", contentSelector = ".content" } = {}) {
    const TabsClass = getTabsClass();
    if (!TabsClass || !root) {
        return;
    }
    const tabs = new TabsClass({ navSelector, contentSelector, initial });
    tabs.bind(root);
}

/**
 * Resolve playlist flags/ids from a directory item element.
 * @param {HTMLElement} element
 * @returns {string|null}
 */
export function getDirectoryEntryId(element) {
    if (!element) {
        return null;
    }
    return element.dataset.entryId
        ?? element.dataset.documentId
        ?? element.dataset.entityId
        ?? element.closest("[data-entry-id], [data-document-id], [data-entity-id]")
            ?.dataset.entryId
        ?? element.closest("[data-entry-id], [data-document-id], [data-entity-id]")
            ?.dataset.documentId
        ?? element.closest("[data-entry-id], [data-document-id], [data-entity-id]")
            ?.dataset.entityId
        ?? null;
}

/**
 * Safe Sound#pause — v14 throws if the sound is not currently PLAYING.
 * @param {*} soundInstance
 */
export function pauseSoundInstance(soundInstance) {
    if (!soundInstance || typeof soundInstance.pause !== "function") {
        return;
    }
    try {
        soundInstance.pause();
    } catch (err) {
        // Already stopped or never started
    }
}

/**
 * Resume a Foundry Sound from its paused offset.
 * @param {*} soundInstance
 * @returns {Promise<*>|undefined}
 */
export function playSoundInstance(soundInstance) {
    if (!soundInstance || typeof soundInstance.play !== "function") {
        return;
    }
    return soundInstance.play({});
}
