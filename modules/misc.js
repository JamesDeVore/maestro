import * as MAESTRO from "./config.js";
import * as Playback from "./playback.js";
import { createPlaylist, getDirectoryEntryId, renderApplication, toElement } from "./foundry-compat.js";
import { MaestroForm, PlaylistTrackFields } from "./forms.js";

/**
 * Playlist directory render hook — inject loop toggles and the Maestro config button.
 * @param {Application} _app
 * @param {HTMLElement|JQuery} html
 * @param {object} [_data]
 */
export function _onRenderPlaylistDirectory(_app, html, _data) {
  const root = toElement(html);
  if (!root) {
    return;
  }
  _addPlaylistLoopToggle(root);
  _addMaestroConfig(root);
}

/**
 * Add a Maestro Config button next to the playlist create control.
 * @param {HTMLElement} root
 */
function _addMaestroConfig(root) {
  if (root.querySelector("button.maestro-config")) {
    return;
  }

  const createPlaylistButton = root.querySelector("button.create-entry, button[data-action='createEntry'], button.create-entity");
  const maestroConfigButton = document.createElement("button");
  maestroConfigButton.type = "button";
  maestroConfigButton.className = "maestro-config";
  maestroConfigButton.innerHTML = `<i class="fas fa-cog"></i> Maestro Config`;

  if (createPlaylistButton) {
    createPlaylistButton.after(maestroConfigButton);
  } else {
    const headerActions = root.querySelector(".header-actions, .directory-footer, footer");
    if (!headerActions) {
      return;
    }
    headerActions.append(maestroConfigButton);
  }

  maestroConfigButton.addEventListener("click", (event) => {
    event.preventDefault();
    renderApplication(new MaestroConfigForm());
  });
}

/**
 * ApplicationV2 settings form for critical success/failure tracks.
 * Instantiated with no arguments from `game.settings.registerMenu`.
 */
export class MaestroConfigForm extends MaestroForm {
  static DEFAULT_OPTIONS = {
    id: "maestro-config",
    window: {
      title: MAESTRO.DEFAULT_CONFIG.Misc.maestroConfigTitle,
      icon: "fas fa-cog"
    }
  };

  /**
   * @param {object} [options]
   * @param {object} [options.data]
   */
  constructor(options = {}) {
    super(options);
    this.data = options.data ?? game.settings.get(
      MAESTRO.MODULE_NAME,
      MAESTRO.SETTINGS_KEYS.Misc.criticalSuccessFailureTracks
    ) ?? {
      criticalSuccessPlaylist: "",
      criticalSuccessSound: "",
      criticalFailurePlaylist: "",
      criticalFailureSound: ""
    };
  }

  /**
   * @returns {object}
   */
  async _prepareContext() {
    return {
      criticalSuccessPlaylist: this._getFieldValue("critical-success-playlist") || this.data.criticalSuccessPlaylist || "",
      criticalSuccessSound: this._getFieldValue("critical-success-sound") || this.data.criticalSuccessSound || "",
      criticalFailurePlaylist: this._getFieldValue("critical-failure-playlist") || this.data.criticalFailurePlaylist || "",
      criticalFailureSound: this._getFieldValue("critical-failure-sound") || this.data.criticalFailureSound || ""
    };
  }

  /**
   * @param {object} context
   * @returns {string}
   */
  _buildFormHTML(context) {
    return `
      <h2>Critical Success and Failure Tracks</h2>
      ${PlaylistTrackFields.render({
        playlistName: "critical-success-playlist",
        trackName: "critical-success-sound",
        playlistLabel: "Critical Success Playlist",
        trackLabel: "Critical Success Sound",
        playlistNotes: "Select a playlist for Critical Success Tracks",
        trackNotes: "Select a track/playback mode",
        playlistValue: context.criticalSuccessPlaylist,
        trackValue: context.criticalSuccessSound
      })}
      ${PlaylistTrackFields.render({
        playlistName: "critical-failure-playlist",
        trackName: "critical-failure-sound",
        playlistLabel: "Critical Failure Playlist",
        trackLabel: "Critical Failure Sound",
        playlistNotes: "Select a playlist for Critical Failure Tracks",
        trackNotes: "Select a track/playback mode",
        playlistValue: context.criticalFailurePlaylist,
        trackValue: context.criticalFailureSound
      })}
      <button type="submit">
        <i class="far fa-save"></i> ${game.i18n.localize("MAESTRO.FORM.SaveSelections")}
      </button>
    `;
  }

  /**
   * Refresh sound lists when a playlist select changes.
   * @param {object} context
   * @param {object} options
   */
  async _onRender(context, options) {
    await super._onRender?.(context, options);
    this._bindPlaylistChange("critical-success-playlist", (value) => {
      this.data.criticalSuccessPlaylist = value;
      this.data.criticalSuccessSound = "";
    });
    this._bindPlaylistChange("critical-failure-playlist", (value) => {
      this.data.criticalFailurePlaylist = value;
      this.data.criticalFailureSound = "";
    });
  }

  /**
   * Persist critical success/failure playlist selections.
   * @param {Event} _event
   * @param {object} formData
   */
  async _persistFormData(_event, formData) {
    const settingsData = {
      criticalSuccessPlaylist: formData["critical-success-playlist"] || "",
      criticalSuccessSound: formData["critical-success-sound"] || "",
      criticalFailurePlaylist: formData["critical-failure-playlist"] || "",
      criticalFailureSound: formData["critical-failure-sound"] || "",
    };
    this.data = settingsData;
    await game.settings.set(
      MAESTRO.MODULE_NAME,
      MAESTRO.SETTINGS_KEYS.Misc.criticalSuccessFailureTracks,
      settingsData
    );
    ui.notifications.info(`${game.i18n.localize("MAESTRO.FORM.SaveSelections")} - Settings saved!`);
  }
}

/**
 * Adds a new toggle for loop to the playlist controls
 * @param {*} html
 */
/**
 * Adds a loop toggle next to each playlist mode control.
 * @param {HTMLElement} root
 */
function _addPlaylistLoopToggle(root) {
  if (root.querySelector(".maestro-playlist-loop")) {
    return;
  }

  const playlistModeButtons = root.querySelectorAll('[data-action="playlistMode"], [data-action="playlist-mode"]');
  if (!playlistModeButtons.length) {
    return;
  }

  for (const modeButton of playlistModeButtons) {
    const loopButton = document.createElement("button");
    loopButton.type = "button";
    loopButton.className = "maestro-playlist-loop inline-control sound-control icon fa-solid fa-sync";
    loopButton.title = game.i18n.localize("PLAYLIST-LOOP.ButtonTooltipLoop");
    loopButton.setAttribute("aria-label", loopButton.title);
    modeButton.after(loopButton);

    const playlistId = getDirectoryEntryId(modeButton);
    const playlist = playlistId ? game.playlists.get(playlistId) : null;
    if (!playlist) {
      continue;
    }

    const loop = playlist.getFlag(
      MAESTRO.MODULE_NAME,
      MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop
    );
    if ([-1, 2].includes(playlist.mode)) {
      loopButton.classList.add("disabled");
      loopButton.disabled = true;
      loopButton.title = game.i18n.localize("PLAYLIST-LOOP.ButtonToolTipDisabled");
    } else if (loop === false) {
      loopButton.classList.add("inactive");
      loopButton.title = game.i18n.localize("PLAYLIST-LOOP.ButtonTooltipNoLoop");
    }

    loopButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (loopButton.classList.contains("disabled")) {
        return;
      }

      const id = getDirectoryEntryId(loopButton);
      if (!id) {
        return;
      }

      const target = game.playlists.get(id);
      if (!target) {
        return;
      }

      if (loopButton.classList.contains("inactive")) {
        target.unsetFlag(
          MAESTRO.MODULE_NAME,
          MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop
        );
        loopButton.classList.remove("inactive");
        loopButton.title = game.i18n.localize("PLAYLIST-LOOP.ButtonTooltipLoop");
      } else {
        target.setFlag(
          MAESTRO.MODULE_NAME,
          MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop,
          false
        );
        loopButton.classList.add("inactive");
        loopButton.title = game.i18n.localize("PLAYLIST-LOOP.ButtonTooltipNoLoop");
      }
    });
  }
}

/**
 * PreUpdate PlaylistSound handler.
 * Foundry v10+ passes the sound document as the first argument, not the playlist.
 * @param {foundry.documents.PlaylistSound} sound
 * @param {object} changed
 */
export function _onPreUpdatePlaylistSound(sound, changed) {
  const playlist = sound?.parent;
  if (!playlist?.playing || !sound.id || ![0, 1].includes(playlist.mode)) {
    return;
  }

  if (changed.playing === false) {
    return playlist.setFlag(
      MAESTRO.MODULE_NAME,
      MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.previousSound,
      sound.id
    );
  }

  const previousSound = playlist.getFlag(
    MAESTRO.MODULE_NAME,
    MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.previousSound
  );

  if (!previousSound) {
    return;
  }

  const order = playlist.mode === 1
    ? playlist.playbackOrder ?? []
    : (playlist.sounds?.contents ?? []).map((s) => s.id ?? s._id);

  const previousIdx = order.indexOf(previousSound);
  const playlistloop = playlist.getFlag(
    MAESTRO.MODULE_NAME,
    MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop
  );

  if (previousIdx === (playlist.sounds?.contents?.length ?? 0) - 1 && playlistloop === false) {
    changed.playing = false;
  }
}

/**
 * PreCreate Chat Message handler — suppress the core dice sound when enabled.
 * @param {foundry.documents.ChatMessage} message
 * @param {object} [data]
 */
export function _onPreCreateChatMessage(message, data) {
  const removeDiceSound = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.disableDiceSound
  );
  const sound = message.sound ?? data?.sound;
  if (!removeDiceSound || !sound || !/dice\.wav$/i.test(sound)) {
    return;
  }

  if (typeof message.updateSource === "function") {
    message.updateSource({ sound: "" });
  } else {
    message.sound = "";
  }
  if (data) {
    data.sound = "";
  }
}

/**
 * Create Chat Message handler — plays critical success/failure audio once per message
 * (renderChatMessage can fire repeatedly for the same document).
 * @param {foundry.documents.ChatMessage} message
 * @param {*} options
 * @param {string} userId
 */
export async function _onCreateChatMessage(message, options, userId) {
  const enableCriticalSuccessFailureTracks = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.enableCriticalSuccessFailureTracks
  );
  const debugLogging = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.debugLogging
  );

  if (!enableCriticalSuccessFailureTracks) {
    if (debugLogging) {
      console.debug("Maestro_pf2e | Crit tracks disabled; message id", message?.id);
    }
    return;
  }

  await playCriticalSuccessFailure(message);
}

/**
 * Play a sound for critical success or failure on PF2e checks (GM only).
 * Invoked from the `createChatMessage` hook so each roll triggers at most once; ducks other audio like hype tracks.
 * @param {foundry.documents.ChatMessage} message
 */
async function playCriticalSuccessFailure(message) {
  const debugLogging = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.debugLogging
  );
  if (!message.isContentVisible) {
    if (debugLogging) {
      console.debug("Maestro_pf2e | Crit skip: message not visible", message?.id);
    }
    return;
  }

  if (!game.user.isGM) {
    if (debugLogging) {
      console.debug("Maestro_pf2e | Crit skip: user not GM");
    }
    return;
  }

  if (game.system.id !== "pf2e") {
    if (debugLogging) {
      console.debug("Maestro_pf2e | Crit skip: non-pf2e system", game.system.id);
    }
    return;
  }

  // Skip damage rolls - they can inherit outcome from the attack check but shouldn't trigger crit sounds
  const isDamageRoll = message.flags?.pf2e?.context?.type === "damage-roll" || 
                       (message.isDamageRoll !== undefined && message.isDamageRoll === true) ||
                       (message.rolls?.[0] && message.rolls[0].constructor?.name === "DamageRoll");
  if (isDamageRoll) {
    if (debugLogging) {
      console.debug("Maestro_pf2e | Crit skip: damage roll", {
        id: message?.id,
        contextType: message.flags?.pf2e?.context?.type,
        isDamageRoll: message.isDamageRoll,
        rollType: message.rolls?.[0]?.constructor?.name
      });
    }
    return;
  }

  const outcome = getPf2eOutcome(message);
  if (!outcome) {
    if (debugLogging) {
      console.debug("Maestro_pf2e | Crit skip: no outcome", {
        id: message?.id,
        flags: message?.flags?.pf2e,
        roll0: message?.rolls?.[0]
      });
    }
    return;
  }

  if (outcome !== "criticalSuccess" && outcome !== "criticalFailure") {
    return;
  }

  const critPlayedFlag = MAESTRO.DEFAULT_CONFIG.Misc.flagNames.critSoundPlayed;
  if (message.getFlag(MAESTRO.MODULE_NAME, critPlayedFlag)) {
    if (debugLogging) {
      console.debug("Maestro_pf2e | Crit skip: already played for message", message?.id);
    }
    return;
  }

  // Get the sounds
  const criticalSuccessFailureTracks = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.criticalSuccessFailureTracks
  );
  const criticalSuccessPlaylist =
    criticalSuccessFailureTracks.criticalSuccessPlaylist;
  const criticalSuccessSound =
    criticalSuccessFailureTracks.criticalSuccessSound;
  const criticalFailurePlaylist =
    criticalSuccessFailureTracks.criticalFailurePlaylist;
  const criticalFailureSound =
    criticalSuccessFailureTracks.criticalFailureSound;

  // Play relevant sound for successes and failures
  if (outcome === "criticalSuccess" && criticalSuccessPlaylist && criticalSuccessSound) {
    if (debugLogging) {
      console.log("Maestro_pf2e | Crit success sound", {
        outcome,
        playlistId: criticalSuccessPlaylist,
        soundId: criticalSuccessSound,
        isRandom: criticalSuccessSound === "random-track"
      });
    }
    try {
      await message.setFlag(MAESTRO.MODULE_NAME, critPlayedFlag, true);
      await Playback.playTrack(criticalSuccessSound, criticalSuccessPlaylist, {
        repeat: false,
        duckOthers: true
      });
    } catch (err) {
      await message.unsetFlag(MAESTRO.MODULE_NAME, critPlayedFlag).catch(() => {});
      console.error("Maestro_pf2e | Crit success playback failed", err);
    }
    return;
  }

  if (outcome === "criticalFailure" && criticalFailurePlaylist && criticalFailureSound) {
    if (debugLogging) {
      console.log("Maestro_pf2e | Crit failure sound", {
        outcome,
        playlistId: criticalFailurePlaylist,
        soundId: criticalFailureSound,
        isRandom: criticalFailureSound === "random-track"
      });
    }
    try {
      await message.setFlag(MAESTRO.MODULE_NAME, critPlayedFlag, true);
      await Playback.playTrack(criticalFailureSound, criticalFailurePlaylist, {
        repeat: false,
        duckOthers: true
      });
    } catch (err) {
      await message.unsetFlag(MAESTRO.MODULE_NAME, critPlayedFlag).catch(() => {});
      console.error("Maestro_pf2e | Crit failure playback failed", err);
    }
  }
}

/**
 * Resolve PF2e check outcome from chat message flags or roll data.
 * Also checks for natural 20/1 on d20 rolls.
 * @param {*} message
 * @returns {string|null} criticalSuccess|criticalFailure|success|failure
 */
function getPf2eOutcome(message) {
  const debugLogging = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.debugLogging
  );
  
  const outcome = message?.flags?.pf2e?.context?.outcome;
  if (outcome) {
    if (debugLogging && (outcome === "criticalSuccess" || outcome === "criticalFailure")) {
      console.log("Maestro_pf2e | Crit outcome from flags", outcome);
    }
    return outcome;
  }

  const roll = message?.rolls?.[0];
  if (!roll) {
    return null;
  }

  // Check for natural 20/1 on d20 dice
  const d20Die = roll.dice?.find(d => d.faces === 20);
  if (d20Die) {
    const naturalRoll = d20Die.results?.find(r => r.active && !r.discarded)?.result ?? d20Die.total;
    if (naturalRoll === 20) {
      if (debugLogging) {
        console.log("Maestro_pf2e | Natural 20 detected");
      }
      return "criticalSuccess";
    }
    if (naturalRoll === 1) {
      if (debugLogging) {
        console.log("Maestro_pf2e | Natural 1 detected");
      }
      return "criticalFailure";
    }
  }

  const degree = roll?.degreeOfSuccess ?? roll?.options?.degreeOfSuccess ?? null;
  if (degree === null || degree === undefined) {
    return null;
  }

  const outcomes = ["criticalFailure", "failure", "success", "criticalSuccess"];
  const result = outcomes[Number(degree)] ?? null;
  if (debugLogging && result && (result === "criticalSuccess" || result === "criticalFailure")) {
    console.log("Maestro_pf2e | Crit outcome from degree", result, "degree:", degree);
  }
  return result;
}

/**
 * Checks for the presence of the Critical playlist, creates one if none exist
 */
export async function _checkForCriticalPlaylist() {
  const enabled = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.enableCriticalSuccessFailureTracks
  );
  const createPlaylist = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.createCriticalSuccessPlaylist
  );

  if (!game.user.isGM || !enabled || !createPlaylist) {
    return;
  }

  let playlist = game.playlists.contents.find(
    (p) => p.name == MAESTRO.DEFAULT_CONFIG.Misc.criticalSuccessPlaylistName
  );

  if (!playlist) {
    playlist = await _createCriticalPlaylist(true);
  }
}

/**
 * Create the Critical playlist if the create param is true
 * @param {Boolean} create - whether or not to create the playlist
 */
async function _createCriticalPlaylist(create) {
  if (!create) {
    return;
  }
  return await createPlaylist({
    name: MAESTRO.DEFAULT_CONFIG.Misc.criticalSuccessPlaylistName,
  });
}

/**
 * Checks for the presence of the Failure playlist, creates one if none exist
 */
export async function _checkForFailurePlaylist() {
  const enabled = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.enableCriticalSuccessFailureTracks
  );
  const createPlaylist = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.createCriticalFailurePlaylist
  );

  if (!game.user.isGM || !enabled || !createPlaylist) {
    return;
  }

  let playlist = game.playlists.contents.find(
    (p) => p.name == MAESTRO.DEFAULT_CONFIG.Misc.criticalFailurePlaylistName
  );

  if (!playlist) {
    playlist = await _createFailurePlaylist(true);
  }
}

/**
 * Create the Failure playlist if the create param is true
 * @param {Boolean} create - whether or not to create the playlist
 */
async function _createFailurePlaylist(create) {
  if (!create) {
    return;
  }
  return await createPlaylist({
    name: MAESTRO.DEFAULT_CONFIG.Misc.criticalFailurePlaylistName,
  });
}

