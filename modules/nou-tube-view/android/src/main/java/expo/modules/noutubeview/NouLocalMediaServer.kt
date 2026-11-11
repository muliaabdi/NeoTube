package expo.modules.noutubeview

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.WebResourceResponse
import java.io.BufferedInputStream
import java.io.File
import java.io.InputStream

/*
 * Serves downloaded media for the virtual origin https://noutube-assets.local
 * (see docs/superpowers/specs/2026-11-10-local-playback-design.md). The
 * <video> overlay seeks by asking for byte ranges, so a plain 200 stream is
 * not enough: every request has to be answered with 206 Partial Content when
 * it carries a Range header, or seeking stalls after the buffered prefix.
 */
object NouLocalMediaServer {
  private val MIME_BY_EXTENSION = mapOf(
    "mp4" to "video/mp4",
    "m4v" to "video/mp4",
    "webm" to "video/webm",
    "mkv" to "video/x-matroska",
    "mp3" to "audio/mpeg",
    "m4a" to "audio/mp4",
    "opus" to "audio/ogg",
    "ogg" to "audio/ogg",
  )

  private fun mimeFor(context: Context, uri: Uri, uriString: String): String {
    if (uri.scheme == "content") {
      val resolvedType = context.contentResolver.getType(uri)
      if (!resolvedType.isNullOrBlank() && resolvedType != "application/octet-stream") {
        return resolvedType
      }
      val displayName = queryColumn(context, uri, OpenableColumns.DISPLAY_NAME) { cursor, index ->
        cursor.getString(index)
      }
      if (!displayName.isNullOrBlank()) {
        val ext = displayName.substringAfterLast('.', "").lowercase()
        MIME_BY_EXTENSION[ext]?.let { return it }
      }
    }
    val extension = uriString.substringAfterLast('.', "").lowercase()
    return MIME_BY_EXTENSION[extension] ?: "application/octet-stream"
  }

  private inline fun <T> queryColumn(
    context: Context,
    uri: Uri,
    column: String,
    read: (android.database.Cursor, Int) -> T?,
  ): T? {
    return try {
      context.contentResolver.query(uri, arrayOf(column), null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return null
        val index = cursor.getColumnIndex(column)
        if (index < 0 || cursor.isNull(index)) null else read(cursor, index)
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun resolveContentLength(context: Context, uri: Uri): Long {
    val fdLength = context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { descriptor ->
      when {
        descriptor.length >= 0 -> descriptor.length
        descriptor.parcelFileDescriptor.statSize >= 0 -> descriptor.parcelFileDescriptor.statSize
        else -> -1L
      }
    } ?: -1L
    if (fdLength >= 0) return fdLength
    return queryColumn(context, uri, OpenableColumns.SIZE) { cursor, index -> cursor.getLong(index) } ?: -1L
  }

  // openAssetFileDescriptor / MediaStore statSize reports sizes MediaStore knows
  // even when the document provider would not hand out a real File.
  private class Source(val length: Long, val open: () -> InputStream?)

  private fun resolve(context: Context, uri: Uri): Source? {
    return try {
      if (uri.scheme == "content") {
        val length = resolveContentLength(context, uri)
        if (length < 0) return null
        Source(length) { context.contentResolver.openInputStream(uri) }
      } else {
        val file = if (uri.scheme == "file") File(uri.path ?: return null) else File(uri.toString())
        if (!file.isFile) return null
        Source(file.length()) { file.inputStream() }
      }
    } catch (_: Exception) {
      null
    }
  }

  // InputStream.skip may stop early per its contract; a media stream that
  // starts mid-file would play garbage, so skip in a loop.
  private fun skipFully(input: InputStream, bytes: Long) {
    var remaining = bytes
    while (remaining > 0) {
      val skipped = input.skip(remaining)
      if (skipped <= 0) {
        if (input.read() == -1) return
        remaining--
      } else {
        remaining -= skipped
      }
    }
  }

  private fun response(
    status: Int,
    reason: String,
    headers: MutableMap<String, String>,
    mime: String,
    stream: InputStream?,
  ): WebResourceResponse {
    val response = WebResourceResponse(mime, "utf-8", status, reason, headers, stream)
    // A 404 handed to the chromium network stack with no body data still has
    // to look like a real HTTP answer or the media element logs a crash.
    return response
  }

  fun openResponse(context: Context, uriString: String, rangeHeader: String?): WebResourceResponse? {
    val uri = Uri.parse(uriString)
    val source = resolve(context, uri) ?: return notFound()
    val mime = mimeFor(context, uri, uriString)
    val corsHeaders = mapOf(
      "Access-Control-Allow-Origin" to "*",
      "Access-Control-Expose-Headers" to "Content-Range, Content-Length, Accept-Ranges",
    )

    val match = Regex("bytes=(\\d+)-(\\d*)").find(rangeHeader ?: "")
    if (match == null) {
      val headers = mutableMapOf(
        "Content-Length" to source.length.toString(),
        "Accept-Ranges" to "bytes",
      ).apply { putAll(corsHeaders) }
      return response(200, "OK", headers, mime, source.open()?.let(::BufferedInputStream))
    }

    val start = match.groupValues[1].toLong()
    if (start >= source.length) {
      // The range points past the file: the one answer that tells the player
      // so is 416 with the total size.
      val headers = mutableMapOf(
        "Content-Range" to "bytes */${source.length}",
        "Accept-Ranges" to "bytes",
      ).apply { putAll(corsHeaders) }
      return response(416, "Range Not Satisfiable", headers, mime, null)
    }
    val end = match.groupValues[2].toLongOrNull()?.coerceAtMost(source.length - 1) ?: source.length - 1
    val stream = source.open()?.let(::BufferedInputStream) ?: return notFound()
    skipFully(stream, start)
    val headers = mutableMapOf(
      "Content-Range" to "bytes $start-$end/${source.length}",
      "Content-Length" to (end - start + 1).toString(),
      "Accept-Ranges" to "bytes",
    ).apply { putAll(corsHeaders) }
    return response(206, "Partial Content", headers, mime, stream)
  }

  private fun notFound(): WebResourceResponse =
    WebResourceResponse("text/plain", "utf-8", 404, "Not Found", mapOf(), null)
}
