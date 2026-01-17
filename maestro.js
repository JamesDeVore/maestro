// @ts-check
import CombatTrack from "./modules/combat-track.js";
import HypeTrack from "./modules/hype-track.js";
import ItemTrack from "./modules/item-track.js";
import * as MAESTRO from "./modules/config.js";
import * as Misc from "./modules/misc.js";
import * as Playback from "./modules/playback.js";
import { registerModuleSettings } from "./modules/settings.js";

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
        Hooks.on("init", () =>{
            game.maestro = {};
            registerModuleSettings();
            Conductor._initHookRegistrations();
        });
    }

    /**
     * Ready Hook
     */
    static async _hookOnReady() {
        Hooks.on("ready", async () => {

            game.maestro.hypeTrack = new HypeTrack();
            game.maestro.itemTrack = new ItemTrack();
            game.maestro.combatTrack = new CombatTrack();

            await Conductor._migrateLegacyNamespace();

            if (game.maestro.hypeTrack) {
                game.maestro.hypeTrack._checkForHypeTracksPlaylist();

                // Hype Track Macro methods
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

            // Macros/external methods
            game.maestro.pause = Playback.pauseSounds;
            game.maestro.playByName = Playback.playSoundByName;
            game.maestro.findSound = Playback.findPlaylistSound;
            game.maestro.pauseAll = Playback.pauseAll;
            game.maestro.resume = Playback.resumeSounds;

            //Set a timeout to allow the sheets to register correctly before we try to hook on them
            window.setTimeout(Conductor._readyHookRegistrations, 500);
            //Conductor._readyHookRegistrations();

            if (game.user.isGM) {
                game.maestro.migration = {};
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
            const oldHypeTrack = actor.getFlag(oldNamespace, MAESTRO.DEFAULT_CONFIG.HypeTrack.flagNames.track);
            if (oldHypeTrack === undefined) {
                continue;
            }
            const newHypeTrack = actor.getFlag(newNamespace, MAESTRO.DEFAULT_CONFIG.HypeTrack.flagNames.track);
            if (newHypeTrack === undefined) {
                await actor.setFlag(newNamespace, MAESTRO.DEFAULT_CONFIG.HypeTrack.flagNames.track, oldHypeTrack);
            }
        }

        for (const playlist of game.playlists.contents) {
            const oldLoop = playlist.getFlag(oldNamespace, MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop);
            const oldPrevious = playlist.getFlag(oldNamespace, MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.previousSound);

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
     * Init Hook Registrations
     */
    static _initHookRegistrations() {
        Conductor._hookOnRenderPlaylistDirectory();
        Conductor._hookOnRenderCombatTracker();
    }

    /**
     * Ready Hook Registrations
     */
    static _readyHookRegistrations() {
        // Sheet/App Render Hooks
        Conductor._hookOnRenderActorSheet();
        Conductor._hookOnRenderItemSheet();
        Conductor._hookOnRenderChatMessage();

        // Pre-Create Hooks
        Conductor._hookOnPreCreateChatMessage();

        // Pre-update Hooks
        Conductor._hookOnPreUpdatePlaylistSound();
        Conductor._hookOnPreUpdatePlaylist();
        Conductor._hookOnPreUpdateCombat();

        // Update Hooks
        Conductor._hookOnUpdateCombat();
        //Conductor._hookOnUpdatePlaylist();

        // Delete hooks
        Conductor._hookOnDeleteCombat();
        
        
    }

    /**
     * PreUpdate Playlist Hook
     */
    static _hookOnPreUpdatePlaylist() {
        Hooks.on("preUpdatePlaylist", (playlist, update, options, userId) => {
        });
    }

    /**
     * PreUpdate Playlist Sound Hook
     */
    static _hookOnPreUpdatePlaylistSound() {
        Hooks.on("preUpdatePlaylistSound", (playlist, sound, update, options, userId) => {
            Misc._onPreUpdatePlaylistSound(playlist, update);
        });
    }

    /**
     * PreCreate Chat Message Hook
     */
    static _hookOnPreCreateChatMessage() {
        Hooks.on("preCreateChatMessage", (message, options, userId) => {
            Misc._onPreCreateChatMessage(message, options);
        });
    }

    /**
     * PreUpdate Combat Hook
     */
    static _hookOnPreUpdateCombat() {
        Hooks.on("preUpdateCombat", (combat, update, options, userId) => {
            game.maestro.combatTrack._checkCombatTrack(combat, update);
        });
    }

    /**
     * Update Combat Hook
     */
    static _hookOnUpdateCombat() {
        Hooks.on("updateCombat", (combat, update, options, userId) => {
            //game.maestro.combatTrack._checkCombatTrack(combat, update);
            game.maestro.hypeTrack._processHype(combat, update);
        });
    }

    /**
     * Delete Combat Hook
     */
    static _hookOnDeleteCombat() {
        Hooks.on("deleteCombat", (combat, options, userId) => {
            game.maestro.combatTrack._stopCombatTrack(combat);
        });
    }
    
    /**
     * Render Actor SheetsHook
     */
    static _hookOnRenderActorSheet() {
        const hookNames = [
            "renderActorSheet",
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
                game.maestro.hypeTrack._addHypeButton(app, html, data);
            });
        }
       
    }

    /**
     * RenderChatMessage Hook
     */
    static _hookOnRenderChatMessage() {
        Hooks.on("renderChatMessage", (message, html, data) => {
            game.maestro.itemTrack.chatMessageHandler(message, html, data);
            Misc._onRenderChatMessage(message, html, data);
        })
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
        if(!game.user.isGM) {
            return;
        }

        Hooks.on("renderItemSheet", (app, html, data) => {
            game.maestro.itemTrack._addItemTrackButton(app, html, data);
        });
        
    }
}

/**
 * Tap, tap, tap, ahem
 * Shall we begin?
 * 
 * Initiates the module
 */
Conductor.begin();
