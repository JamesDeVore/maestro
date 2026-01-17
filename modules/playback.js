import * as MAESTRO from "./config.js";


/**
* Get all the sounds in a specific playlist
*/
export function getPlaylistSounds(playlistId) {
    if (!playlistId) {
        return;
    }
    const playlist = game.playlists.get(playlistId);

    if (!playlist) {
        return;
    }

    return playlist.sounds?.contents ?? [];
}

/**
 * For a given trackId get the corresponding playlist sound
 * @param {String} trackId 
 */
export function getPlaylistSound(trackId) {
    if (!this.playlist) {
        return;
    }
    return this.playlist.sounds?.contents?.find(s => s.id == trackId);
}

/**
 * Play a playlist sound based on the given trackId
 * @param {String} trackId - the track Id or playback mode
 * @param {String} playlistId - the playlist id
 * @param {Object} [options]
 * @param {boolean} [options.repeat] - override sound repeat behavior
 */
export async function playTrack(trackId, playlistId, {repeat} = {}) {
    if (!playlistId) {
        return;
    }

    const playlist = game.playlists.get(playlistId);

    if (!playlist) {
        return;
    }

    if (trackId === MAESTRO.DEFAULT_CONFIG.ItemTrack.playbackModes.random) {
        trackId = playlist.playbackOrder?.[0];
    }

    if(!trackId) {
        return;
    }

    const sound = playlist.sounds?.get(trackId) ?? playlist.sounds?.contents?.find(s => s.id === trackId || s._id === trackId);
    if (!sound) {
        return;
    }

    if (repeat === false && sound.repeat) {
        await sound.update({repeat: false});
    }

    return await playlist.playSound(sound);
}

/**
 * Play a playlist using its default playback method
 * @param {String} playlistId
 */
export async function playPlaylist(playlistId) {
    if (!playlistId) {
        return;
    }

    const playlist = game.playlists.get(playlistId);

    if (!playlist) {
        return;
    }

    await playlist.playAll();
}

/**
 * Finds a sound EmbeddedEntity by its name
 * @param {*} name 
 */
export function findPlaylistSound(searchString, findBy="name") {
    const playlist = game.playlists.contents.find(p => p.sounds?.contents?.find(s => s[findBy] === searchString));
    return playlist ? {playlist, sound: playlist.sounds.contents.find(s => s[findBy] === searchString)} : null;
}

/**
 * Play a sound by its name rather than id
 * @param {*} name 
 * @param {*} options 
 */
export function playSoundByName(name, {playlist=null}={}) {
    // If no playlist provided, try to find the first matching one
    if (!playlist) {
        let {playlist, sound} = findPlaylistSound(name) || {};
        
        if (!playlist) {
            ui.warn(game.i18n.localize("PLAYBACK.PlaySoundByName.NoPlaylist"));
            return;
        }
    }

    const sound = playlist.sounds?.contents?.find(s => s.name === name);
    if (!sound) {
        return;
    }

    playlist.playSound(sound);
}

/**
 * Pauses a playing howl
 * @param {*} sounds 
 */
export function pauseSounds(sounds) {
    if (!sounds) {
        return;
    }

    if (!(sounds instanceof Array)) {
        sounds = [sounds];
    }

    const pausedSounds = [];

    for (let sound of sounds) {
        let playlistSound;

        // If the sound param is a string, determine if it is a name or a path
        if (typeof(sound) === "string") {
            playlistSound = findPlaylistSound(sound)?.sound || findPlaylistSound(sound, "path")?.sound || null;
        } else if (sound instanceof Object) {
            const playlist = game.playlists.contents.find(p => p.sounds?.contents?.find(s => s._id === sound._id)) || null;
            playlistSound = playlist ? playlist.sounds.contents.find(s => s._id === sound._id) : null;
        }

        if (!playlistSound) {
            return;
        }
        const soundInstance = playlistSound.sound;
        soundInstance?.pause();
        pausedSounds.push(playlistSound);
    }

    return pausedSounds;
}

/**
 * Resume playback on one or many howls
 * @param {*} sounds 
 */
export function resumeSounds(sounds) {
    if (!(sounds instanceof Array)) {
        sounds = [sounds];
    }

    const resumedSounds = [];

    for (const sound of sounds) {
        const soundInstance = sound.sound;
        soundInstance?.play();
        resumedSounds.push(sound);
    }

    return resumedSounds;
}

/**
 * Pauses all active playlist sounds
 */
export function pauseAll() {
    // Find active playlists and sounds and pause them
    const activePlaylists = game.playlists.contents.filter(p => p.playing);

    if (!activePlaylists.length) return;

    const activeSounds = activePlaylists.flatMap(p => {
        return p.sounds?.contents?.filter(s => s.playing) ?? [];
    });

    if (!activeSounds.length) return;

    const pausedSounds = pauseSounds(activeSounds);
    return pausedSounds;
}