// @ts-check
import { registerModuleSettings } from "./modules/settings.js";
import CombatTrack from "./modules/combat-track.js";
import HypeTrack from "./modules/hype-track.js";
import ItemTrack from "./modules/item-track.js";
import * as MAESTRO from "./modules/config.js";
import * as Misc from "./modules/misc.js";
import * as Playback from "./modules/playback.js";

/**
 * Orchestrates (pun) module functionality
 */
export default class Conductor {
    static begin() {
        Conductor._hookOnInit();
        Conductor._hookOnReady();
    }

    /**
     * Init Hook
     */
    static async _hookOnInit() {
        Hooks.on("init", () => {
            game.maestro = game.maestro ?? {};
            try {
                registerModuleSettings();
            } catch (err) {
                console.error("Maestro_pf2e | Failed to register settings", err);
            }
            try {
                Conductor._initHookRegistrations();
            } catch (err) {
                console.error("Maestro_pf2e | Failed to register init hooks", err);
            }
        });
    }

    /**
     * Ready Hook
     */
    static async _hookOnReady() {
        Hooks.on("ready", async () => {
            try {
                game.maestro.hypeTrack = new HypeTrack();
                game.maestro.itemTrack = new ItemTrack();
                game.maestro.combatTrack = new CombatTrack();

                await Conductor._migrateLegacyNamespace();

                if (game.maestro.hypeTrack) {
                    game.maestro.hypeTrack._checkForHypeTracksPlaylist();
                    game.maestro.playHype = game.maestro.hypeTrack.playHype.bind(game.maestro.hypeTrack);
                }

                if (game.maestro.itemTrack) {
                    game.maestro.itemTrack._checkForItemTracksPlaylist();
                }

                if (game.maestro.combatTrack) {
                    game.maestro.combatTrack._checkForCombatTracksPlaylist();
                }

                Misc._checkForCriticalPlaylist();
                Misc._checkForFailurePlaylist();

                game.maestro.pause = Playback.pauseSounds;
                game.maestro.playByName = Playback.playSoundByName;
                game.maestro.findSound = Playback.findPlaylistSound;
                game.maestro.pauseAll = Playback.pauseAll;
                game.maestro.resume = Playback.resumeSounds;

                if (game.user.isGM) {
                    game.maestro.migration = {};
                }
            } catch (err) {
                console.error("Maestro_pf2e | Failed during ready setup", err);
            }

            try {
                Conductor._readyHookRegistrations();
            } catch (err) {
                console.error("Maestro_pf2e | Failed to register ready hooks", err);
            }
        });
    }

    /**
     * Migrate settings and flags from the legacy "maestro" namespace to this fork's namespace.
     */
    static async _migrateLegacyNamespace() {
        const oldNamespace = "maestro";
        const newNamespace = MAESTRO.MODULE_NAME;

        if (!game.user.isGM || oldNamespace === newNamespace) {
            return;
        }

        const hasMigrated = game.settings.get(
            newNamespace,
            MAESTRO.SETTINGS_KEYS.Migration.legacyNamespaceMigrated
        );
        if (hasMigrated) {
            return;
        }

        const worldSettings = game.settings.storage?.get?.("world");
        const settingKeys = [
            ...Object.values(MAESTRO.SETTINGS_KEYS.HypeTrack),
            ...Object.values(MAESTRO.SETTINGS_KEYS.ItemTrack),
            ...Object.values(MAESTRO.SETTINGS_KEYS.CombatTrack),
            ...Object.values(MAESTRO.SETTINGS_KEYS.Misc),
        ];
        const skipKeys = new Set([
            MAESTRO.SETTINGS_KEYS.Migration.currentVersion,
            MAESTRO.SETTINGS_KEYS.Migration.legacyNamespaceMigrated,
            MAESTRO.SETTINGS_KEYS.Misc.maestroConfigMenu,
        ]);

        for (const key of new Set(settingKeys)) {
            if (skipKeys.has(key)) {
                continue;
            }

            const newSettingKey = `${newNamespace}.${key}`;
            const oldSettingKey = `${oldNamespace}.${key}`;
            const newStored = worldSettings?.get?.(newSettingKey);
            if (newStored?.value !== undefined) {
                continue;
            }

            let oldValue;
            const oldStored = worldSettings?.get?.(oldSettingKey);
            if (oldStored) {
                oldValue = oldStored.value;
            } else {
                try {
                    oldValue = game.settings.get(oldNamespace, key);
                } catch (err) {
                    oldValue = undefined;
                }
            }

            if (oldValue !== undefined) {
                await game.settings.set(newNamespace, key, oldValue);
            }
        }

        for (const actor of game.actors.contents) {
            const oldHypeTrack = actor.flags?.[oldNamespace]?.[MAESTRO.DEFAULT_CONFIG.HypeTrack.flagNames.track];
            if (oldHypeTrack === undefined) {
                continue;
            }
            const newHypeTrack = actor.getFlag(newNamespace, MAESTRO.DEFAULT_CONFIG.HypeTrack.flagNames.track);
            if (newHypeTrack === undefined) {
                await actor.setFlag(newNamespace, MAESTRO.DEFAULT_CONFIG.HypeTrack.flagNames.track, oldHypeTrack);
            }
        }

        for (const playlist of game.playlists.contents) {
            const oldLoop = playlist.flags?.[oldNamespace]?.[MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop];
            const oldPrevious = playlist.flags?.[oldNamespace]?.[MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.previousSound];

            const newLoop = playlist.getFlag(newNamespace, MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop);
            const newPrevious = playlist.getFlag(newNamespace, MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.previousSound);

            if (oldLoop !== undefined && newLoop === undefined) {
                await playlist.setFlag(newNamespace, MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop, oldLoop);
            }

            if (oldPrevious !== undefined && newPrevious === undefined) {
                await playlist.setFlag(
                    newNamespace,
                    MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.previousSound,
                    oldPrevious
                );
            }
        }

        await game.settings.set(newNamespace, MAESTRO.SETTINGS_KEYS.Migration.legacyNamespaceMigrated, true);
    }

    /**
     * Register Foundry hooks that Maestro needs. Called from `init` so they exist
     * before any sheet or sidebar is rendered.
     */
    static _initHookRegistrations() {
        Conductor._hookOnRenderPlaylistDirectory();
        Conductor._hookOnRenderCombatTracker();
        Conductor._hookOnGetHeaderControls();
        Conductor._hookOnRenderActorSheet();
        Conductor._hookOnRenderItemSheet();
        Conductor._hookOnRenderChatMessage();
        Conductor._hookOnCreateChatMessage();
        Conductor._hookOnPreCreateChatMessage();
        Conductor._hookOnPreUpdatePlaylistSound();
        Conductor._hookOnPreUpdatePlaylist();
        Conductor._hookOnPreUpdateCombat();
        Conductor._hookOnUpdateCombat();
        Conductor._hookOnDeleteCombat();
    }

    /**
     * Ready-time hook registrations. Feature hooks are registered on `init`; this
     * remains as a debug checkpoint after playlist/setup work finishes.
     */
    static _readyHookRegistrations() {
        const debug = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.Misc.debugLogging);
        if (debug) {
            console.log("Maestro_pf2e | Registering hooks...");
        }
        
        if (debug) {
            console.log("Maestro_pf2e | Ready hooks already registered on init");
        }
    }

    /**
     * PreUpdate Playlist Hook
     */
    static _hookOnPreUpdatePlaylist() {
        Hooks.on("preUpdatePlaylist", (playlist, update, options, userId) => {
        });
    }

    /**
     * PreUpdate PlaylistSound hook — Foundry v10+ passes the sound document first.
     */
    static _hookOnPreUpdatePlaylistSound() {
        Hooks.on("preUpdatePlaylistSound", (sound, changed) => {
            Misc._onPreUpdatePlaylistSound(sound, changed);
        });
    }

    /**
     * PreCreate Chat Message hook — suppress the dice sound when that setting is enabled.
     */
    static _hookOnPreCreateChatMessage() {
        Hooks.on("preCreateChatMessage", (message, data) => {
            Misc._onPreCreateChatMessage(message, data);
        });
    }

    /**
     * PreUpdate Combat Hook
     */
    static _hookOnPreUpdateCombat() {
        Hooks.on("preUpdateCombat", (combat, update, options, userId) => {
            game.maestro.combatTrack?._checkCombatTrack(combat, update);
        });
    }

    /**
     * Update Combat Hook
     */
    static _hookOnUpdateCombat() {
        Hooks.on("updateCombat", (combat, update, options, userId) => {
            const debug = game.settings.get(MAESTRO.MODULE_NAME, MAESTRO.SETTINGS_KEYS.Misc.debugLogging);
            if (debug) {
                console.log("Maestro_pf2e | updateCombat hook fired", { 
                    turn: update.turn, 
                    round: update.round, 
                    combatant: combat.combatant?.actor?.name,
                    hasHypeTrack: !!game.maestro.hypeTrack 
                });
            }
            //game.maestro.combatTrack._checkCombatTrack(combat, update);
            if (game.maestro.hypeTrack) {
                game.maestro.hypeTrack._processHype(combat, update);
            } else if (debug) {
                console.warn("Maestro_pf2e | updateCombat: hypeTrack not initialized");
            }
        });
    }

    /**
     * Delete Combat Hook
     */
    static _hookOnDeleteCombat() {
        Hooks.on("deleteCombat", (combat, options, userId) => {
            game.maestro.combatTrack?._stopCombatTrack(combat);
        });
    }
    
    /**
     * Render Actor SheetsHook
     */
    static _hookOnRenderActorSheet() {
        const hookNames = [
            "renderActorSheet",
            "renderActorSheetV2",
            "renderCharacterSheetPF2e",
            "renderNPCSheetPF2e",
            "renderCreatureSheetPF2e",
            "renderFamiliarSheetPF2e",
            "renderHazardSheetPF2e",
            "renderLootSheetPF2e",
            "renderPartySheetPF2e",
            "renderVehicleSheetPF2e",
            "renderArmySheetPF2e"
        ];

        for (const hookName of hookNames) {
            Hooks.on(hookName, (app, html, data) => {
                const debugLogging = game.settings.get(
                    MAESTRO.MODULE_NAME,
                    MAESTRO.SETTINGS_KEYS.Misc.debugLogging
                );
                if (debugLogging) {
                    console.debug("Maestro_pf2e | render hook", {
                        hookName,
                        appName: app?.constructor?.name,
                        actorId: app?.actor?.id ?? app?.object?.id ?? app?.document?.id ?? app?.entity?.id
                    });
                }
                game.maestro.hypeTrack?._addHypeButton(app, html, data);
            });
        }
       
    }

    /**
     * RenderChatMessage Hook
     */
    /**
     * Chat-card render hook. Foundry v13+ uses renderChatMessageHTML (HTMLElement);
     * renderChatMessage is kept as a fallback for older clients.
     */
    static _hookOnRenderChatMessage() {
        const handler = (message, html, data) => {
            game.maestro.itemTrack?.chatMessageHandler(message, html, data);
        };
        Hooks.on("renderChatMessageHTML", handler);
        Hooks.on("renderChatMessage", handler);
    }

    /**
     * ApplicationV2 header-control hook for actor/item sheets that no longer expose a V1 header.
     */
    static _hookOnGetHeaderControls() {
        Hooks.on("getHeaderControlsApplicationV2", (app, controls) => {
            game.maestro.hypeTrack?.addHypeHeaderControl(app, controls);
            if (game.user.isGM) {
                game.maestro.itemTrack?.addItemHeaderControl(app, controls);
            }
        });
    }

    /**
     * CreateChatMessage Hook — critical roll sounds (once per message; see Misc module).
     */
    static _hookOnCreateChatMessage() {
        Hooks.on("createChatMessage", async (message, options, userId) => {
            await Misc._onCreateChatMessage(message, options, userId);
        });
    }

    /**
     * RenderPlaylistDirectory Hook
     */
    static _hookOnRenderPlaylistDirectory() {
        Hooks.on("renderPlaylistDirectory", (app, html, data) => {
            Misc._onRenderPlaylistDirectory(app, html, data);
        });
    }

    /**
     * RenderCombatTracker Hook
     */
    static _hookOnRenderCombatTracker() {
        Hooks.on("renderCombatTracker", (app, html, data) => {
            CombatTrack._addCombatTrackButton(app, html, data);
        });
    }

    /**
     * Render Item Sheet Hook
     */
    static _hookOnRenderItemSheet() {
        const handler = (app, html, data) => {
            game.maestro.itemTrack?._addItemTrackButton(app, html, data);
        };
        Hooks.on("renderItemSheet", handler);
        Hooks.on("renderItemSheetV2", handler);
    }
}

/**
 * Tap, tap, tap, ahem
 * Shall we begin?
 * 
 * Initiates the module
 */
try {
    Conductor.begin();
} catch (err) {
    console.error("Maestro_pf2e | Failed to start Conductor", err);
}
