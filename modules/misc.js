import * as MAESTRO from "./config.js";
import * as Playback from "./playback.js";

export function _onRenderPlaylistDirectory(app, html, data) {
  // Convert html to jQuery if it's not already
  const $html = html instanceof jQuery ? html : $(html);
  _addPlaylistLoopToggle($html);
  _addMaestroConfig($html);
}

function _addMaestroConfig(html) {
  // Ensure html is a jQuery object
  const $html = html instanceof jQuery ? html : $(html);
  const createPlaylistButton = $html.find("button.create-entity");

  const footerFlexDivHtml = `<div class="flexrow"></div>`;

  const maestroConfigButtonHtml = `<button class="maestro-config">
            <i class="fas fa-cog"></i> Maestro Config
        </button>`;

  createPlaylistButton.wrap(footerFlexDivHtml);
  createPlaylistButton.after(maestroConfigButtonHtml);

  const maestroConfigButton = $html.find("button.maestro-config");

  maestroConfigButton.on("click", (event) => {
    event.preventDefault();
    const data = game.settings.get(
      MAESTRO.MODULE_NAME,
      MAESTRO.SETTINGS_KEYS.Misc.criticalSuccessFailureTracks
    );

    new MaestroConfigForm(data).render(true);
  });
}

export class MaestroConfigForm extends FormApplication {
  constructor(data, options) {
    super(data, options);
    this.data = data;
  }

  /**
   * Default Options for this FormApplication
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "maestro-config",
      title: MAESTRO.DEFAULT_CONFIG.Misc.maestroConfigTitle,
      classes: ["sheet"],
      width: 500,
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
          criticalSuccessPlaylist: $form.find("select[name='critical-success-playlist']").val() || "",
          criticalSuccessSound: $form.find("select[name='critical-success-sound']").val() || "",
          criticalFailurePlaylist: $form.find("select[name='critical-failure-playlist']").val() || "",
          criticalFailureSound: $form.find("select[name='critical-failure-sound']").val() || ""
        };
      }
    }

    const criticalSuccessFailureTracks = game.settings.get(
      MAESTRO.MODULE_NAME,
      MAESTRO.SETTINGS_KEYS.Misc.criticalSuccessFailureTracks
    );

    if (!this.data && criticalSuccessFailureTracks) {
      this.data = criticalSuccessFailureTracks;
    }
    
    // Ensure this.data exists with defaults
    if (!this.data) {
      this.data = {
        criticalSuccessPlaylist: "",
        criticalSuccessSound: "",
        criticalFailurePlaylist: "",
        criticalFailureSound: ""
      };
    }

    // Use current form values if available (preserves user input during re-render), otherwise use saved data
    const currentSuccessPlaylist = currentFormValues.criticalSuccessPlaylist || this.data.criticalSuccessPlaylist || "";
    const currentFailurePlaylist = currentFormValues.criticalFailurePlaylist || this.data.criticalFailurePlaylist || "";
    const currentSuccessSound = currentFormValues.criticalSuccessSound || this.data.criticalSuccessSound || "";
    const currentFailureSound = currentFormValues.criticalFailureSound || this.data.criticalFailureSound || "";
    
    // Get playlists
    const playlistsContents = game.playlists?.contents || [];
    const playlists = Array.isArray(playlistsContents) ? playlistsContents : [];
    
    // Get sounds for selected playlists
    const criticalSuccessSounds = this.data.criticalSuccessPlaylist && playlists.length > 0
      ? (Playback.getPlaylistSounds(this.data.criticalSuccessPlaylist) || [])
      : [];
    const criticalFailureSounds = this.data.criticalFailurePlaylist && playlists.length > 0
      ? (Playback.getPlaylistSounds(this.data.criticalFailurePlaylist) || [])
      : [];

    // Build HTML
    let html = `<form autocomplete="off" onsubmit="event.preventDefault(); return false;">
      <h2>Critical Success and Failure Tracks</h2>

      <div class="form-group">
        <label>Critical Success Playlist</label>
        <select name="critical-success-playlist" class="playlist-select">
          <option value="" ${!currentSuccessPlaylist ? 'selected="selected"' : ''}>--None--</option>`;

    // Add playlist options
    for (const playlist of playlists) {
      const selected = playlist.id === currentSuccessPlaylist ? 'selected="selected"' : '';
      html += `\n          <option value="${playlist.id}" ${selected}>${playlist.name}</option>`;
    }

    html += `
        </select>
        <p class="notes">Select a playlist for Critical Success Tracks</p>
      </div>

      <div class="form-group">
        <label>Critical Success Sound</label>
        <select name="critical-success-sound" class="track-select">
          <option value="" ${!currentSuccessSound ? 'selected="selected"' : ''}>--None--</option>`;

    if (criticalSuccessSounds.length > 0) {
      html += `\n          <option value="random-track" ${currentSuccessSound === "random-track" ? 'selected="selected"' : ''}>--Play Random Track--</option>`;
      html += `\n          <option value="play-all" ${currentSuccessSound === "play-all" ? 'selected="selected"' : ''}>--Play Playlist--</option>`;
      
      for (const sound of criticalSuccessSounds) {
        const soundId = sound.id ?? sound._id;
        const selected = soundId === currentSuccessSound ? 'selected="selected"' : '';
        html += `\n          <option value="${soundId}" ${selected}>${sound.name}</option>`;
      }
    }

    html += `
        </select>
        <p class="notes">Select a track/playback mode</p>
      </div>

      <div class="form-group">
        <label>Critical Failure Playlist</label>
        <select name="critical-failure-playlist" class="playlist-select">
          <option value="" ${!currentFailurePlaylist ? 'selected="selected"' : ''}>--None--</option>`;

    // Add playlist options
    for (const playlist of playlists) {
      const selected = playlist.id === currentFailurePlaylist ? 'selected="selected"' : '';
      html += `\n          <option value="${playlist.id}" ${selected}>${playlist.name}</option>`;
    }

    html += `
        </select>
        <p class="notes">Select a playlist for Critical Failure Tracks</p>
      </div>

      <div class="form-group">
        <label>Critical Failure Sound</label>
        <select name="critical-failure-sound" class="track-select">
          <option value="" ${!currentFailureSound ? 'selected="selected"' : ''}>--None--</option>`;

    if (criticalFailureSounds.length > 0) {
      html += `\n          <option value="random-track" ${currentFailureSound === "random-track" ? 'selected="selected"' : ''}>--Play Random Track--</option>`;
      html += `\n          <option value="play-all" ${currentFailureSound === "play-all" ? 'selected="selected"' : ''}>--Play Playlist--</option>`;
      
      for (const sound of criticalFailureSounds) {
        const soundId = sound.id ?? sound._id;
        const selected = soundId === currentFailureSound ? 'selected="selected"' : '';
        html += `\n          <option value="${soundId}" ${selected}>${sound.name}</option>`;
      }
    }

    html += `
        </select>
        <p class="notes">Select a track/playback mode</p>
      </div>

      <button type="submit" name="submit">
        <i class="far fa-save"></i> Save Selections
      </button>
    </form>`;

    return $(html);
  }

  /**
   * Update on form submit
   * @param {*} event
   * @param {*} formData
   */
  async _updateObject(event, formData) {
    const settingsData = {
      criticalSuccessPlaylist: formData["critical-success-playlist"] || "",
      criticalSuccessSound: formData["critical-success-sound"] || "",
      criticalFailurePlaylist: formData["critical-failure-playlist"] || "",
      criticalFailureSound: formData["critical-failure-sound"] || "",
    };
    
    // Update this.data to reflect saved values
    this.data = settingsData;
    
    await game.settings.set(
      MAESTRO.MODULE_NAME,
      MAESTRO.SETTINGS_KEYS.Misc.criticalSuccessFailureTracks,
      settingsData
    );
    ui.notifications.info(game.i18n.localize("MAESTRO.FORM.SaveSelections") + " - Settings saved!");
  }

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

    const criticalPlaylistSelect = $html.find(
      "select[name='critical-success-playlist']"
    );
    const failurePlaylistSelect = $html.find(
      "select[name='critical-failure-playlist']"
    );

    if (criticalPlaylistSelect.length > 0) {
      criticalPlaylistSelect.on("change", (event) => {
        event.preventDefault();
        this.data.criticalSuccessPlaylist = event.target.value;
        this.render();
      });
    }

    if (failurePlaylistSelect.length > 0) {
      failurePlaylistSelect.on("change", (event) => {
        event.preventDefault();
        this.data.criticalFailurePlaylist = event.target.value;
        this.render();
      });
    }

    // Handle save button click explicitly
    const saveButton = $html.find("button[type='submit']");
    if (saveButton.length > 0) {
      saveButton.on("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Collect form data directly from select elements to ensure we get current values
        const formObject = {
          "critical-success-playlist": $html.find("select[name='critical-success-playlist']").val() || "",
          "critical-success-sound": $html.find("select[name='critical-success-sound']").val() || "",
          "critical-failure-playlist": $html.find("select[name='critical-failure-playlist']").val() || "",
          "critical-failure-sound": $html.find("select[name='critical-failure-sound']").val() || ""
        };
        
        await this._updateObject(event, formObject);
        this.close();
      });
    }
  }
}

/**
 * Adds a new toggle for loop to the playlist controls
 * @param {*} html
 */
function _addPlaylistLoopToggle(html) {
  // Ensure html is a jQuery object
  const $html = html instanceof jQuery ? html : $(html);
  const playlistModeButtons = $html.find('[data-action="playlist-mode"]');
  const loopToggleHtml = `<a class="sound-control" data-action="playlist-loop" title="${game.i18n.localize(
    "PLAYLIST-LOOP.ButtonTooltipLoop"
  )}">
            <i class="fas fa-sync"></i>
        </a>`;

  playlistModeButtons.after(loopToggleHtml);

  const loopToggleButtons = $html.find('[data-action="playlist-loop"]');

  if (loopToggleButtons.length === 0) {
    return;
  }

  // Widen the parent div
  const controlsDiv = loopToggleButtons.closest(".playlist-controls");
  controlsDiv.css("flex-basis", "110px");

  for (const button of loopToggleButtons) {
    const buttonClass = button.getAttribute("class");
    const buttonTitle = button.getAttribute("title");

    const playlistDiv = button.closest(".entity");
    const playlistId = playlistDiv.getAttribute("data-entity-id");
    const playlist = game.playlists.get(playlistId);

    const loop = playlist.getFlag(
      MAESTRO.MODULE_NAME,
      MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop
    );
    const mode = playlist.mode;
    if ([-1, 2].includes(mode)) {
      button.setAttribute("class", buttonClass.concat(" disabled"));
      button.setAttribute(
        "title",
        game.i18n.localize("PLAYLIST-LOOP.ButtonToolTipDisabled")
      );
    } else if (loop === false) {
      button.setAttribute("class", buttonClass.concat(" inactive"));
      button.setAttribute(
        "title",
        game.i18n.localize("PLAYLIST-LOOP.ButtonTooltipNoLoop")
      );
    }
  }

  loopToggleButtons.on("click", (event) => {
    const button = event.currentTarget;
    const buttonClass = button.getAttribute("class");

    if (!buttonClass) {
      return;
    }

    const playlistDiv = button.closest(".entity");
    const playlistId = playlistDiv.getAttribute("data-entity-id");

    if (!playlistId) {
      return;
    }

    if (buttonClass.includes("inactive")) {
      game.playlists
        .get(playlistId)
        .unsetFlag(
          MAESTRO.MODULE_NAME,
          MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop
        );
      button.setAttribute("class", buttonClass.replace(" inactive", ""));
      button.setAttribute(
        "title",
        game.i18n.localize("PLAYLIST-LOOP.ButtonTooltipLoop")
      );
    } else {
      game.playlists
        .get(playlistId)
        .setFlag(
          MAESTRO.MODULE_NAME,
          MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop,
          false
        );
      button.setAttribute("class", buttonClass.concat(" inactive"));
      button.setAttribute(
        "title",
        game.i18n.localize("PLAYLIST-LOOP.ButtonTooltipNoLoop")
      );
    }
  });
}

/**
 * PreUpdate Playlist Sound handler
 * @param {*} playlist
 * @param {*} update
 * @todo maybe return early if no flag set?
 */
export function _onPreUpdatePlaylistSound(playlist, update) {
  // Return if there's no id or the playlist is not in sequential or shuffl mode
  if (!playlist.playing || !update._id || ![0, 1].includes(playlist.mode)) {
    return;
  }

  // If the update is a sound playback ending, save it as the previous track and return
  if (update.playing === false) {
    return playlist.setFlag(
      MAESTRO.MODULE_NAME,
      MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.previousSound,
      update._id
    );
  }

  // Otherwise it must be a sound playback starting:
  const previousSound = playlist.getFlag(
    MAESTRO.MODULE_NAME,
    MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.previousSound
  );

  if (!previousSound) {
    return;
  }

  let order;

  // If shuffle order exists, use that, else map the sounds to an order
  if (playlist.mode === 1) {
    order = playlist.playbackOrder ?? [];
  } else {
    order = (playlist.sounds?.contents ?? []).map((s) => s._id);
  }

  const previousIdx = order.indexOf(previousSound);
  const playlistloop = playlist.getFlag(
    MAESTRO.MODULE_NAME,
    MAESTRO.DEFAULT_CONFIG.PlaylistLoop.flagNames.loop
  );

  // If the previous sound was the last in the order, and playlist loop is set to false, don't play the incoming sound
  if (previousIdx === (playlist.sounds?.contents?.length ?? 0) - 1 && playlistloop === false) {
    update.playing = false;
  }
}

/**
 * PreCreate Chat Message handler
 */
export function _onPreCreateChatMessage(message, options, userId) {
  const removeDiceSound = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.disableDiceSound
  );

  if (removeDiceSound && message.sound && message.sound === "sounds/dice.wav") {
    message.sound = "";
  }
}

/**
 * Render Chat Message handler
 * @param {*} message
 * @param {*} html
 * @param {*} data
 */
export function _onRenderChatMessage(message, html, data) {
  const enableCriticalSuccessFailureTracks = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.enableCriticalSuccessFailureTracks
  );
  const debugLogging = game.settings.get(
    MAESTRO.MODULE_NAME,
    MAESTRO.SETTINGS_KEYS.Misc.debugLogging
  );

  if (enableCriticalSuccessFailureTracks) {
    playCriticalSuccessFailure(message);
  } else if (debugLogging) {
    console.debug("Maestro_pf2e | Crit tracks disabled; message id", message?.id);
  }
}

/**
 * Play a sound for critical success or failure on PF2e checks
 * @param {*} message
 */
function playCriticalSuccessFailure(message) {
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
    Playback.playTrack(criticalSuccessSound, criticalSuccessPlaylist, {repeat: false});
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
    Playback.playTrack(criticalFailureSound, criticalFailurePlaylist, {repeat: false});
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
  return await Playlist.create({
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
  return await Playlist.create({
    name: MAESTRO.DEFAULT_CONFIG.Misc.criticalFailurePlaylistName,
  });
}

