package expo.modules.noutubeview

import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

/*
 * The native half of the local playback index. The app pushes the same JSON
 * the webviews get as localStorage['nou:downloads'] (states/downloads-index.ts)
 * through the syncLocalMediaIndex module function, and shouldInterceptRequest
 * looks entries up here when the page asks the virtual origin for a video.
 */
object NouLocalMediaRegistry {
  private val urisByVideoId = ConcurrentHashMap<String, String>()

  // Shape: { "<videoId>": { uri, audioOnly, ... } }. Entries arrive as one
  // blob, so the whole map is replaced to drop files the app no longer lists;
  // audio-only downloads never have a video to overlay.
  fun set(json: String) {
    val next = ConcurrentHashMap<String, String>()
    try {
      val entries = JSONObject(json)
      for (key in entries.keys()) {
        val entry = entries.optJSONObject(key) ?: continue
        if (entry.optBoolean("audioOnly")) continue
        val uri = entry.optString("uri")
        if (uri.isNotEmpty()) {
          next[key] = uri
        }
      }
    } catch (_: Exception) {
      return
    }
    urisByVideoId.clear()
    urisByVideoId.putAll(next)
  }

  fun getUri(videoId: String): String? = urisByVideoId[videoId]
}
