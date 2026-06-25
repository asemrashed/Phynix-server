import { parseYoutubeId } from "./video-source"

export type ParsedVideoSource =
  | { kind: "youtube"; videoId: string }
  | { kind: "file"; ref: string }

export function parseStoredVideoRef(
  provider: string | null,
  videoRef: string | null
): ParsedVideoSource | null {
  if (!videoRef?.trim()) return null

  const raw = videoRef.trim()
  const resolvedProvider = provider || "YOUTUBE"

  if (resolvedProvider === "YOUTUBE") {
    const videoId = parseYoutubeId(raw)
    if (!videoId) return null
    return { kind: "youtube", videoId }
  }

  if (resolvedProvider === "SELF_HOSTED") {
    return { kind: "file", ref: raw }
  }

  return null
}

/** CSP for the YouTube bridge page — helmet default blocks youtube.com scripts. */
export const YOUTUBE_EMBED_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://www.youtube.com https://www.youtube-nocookie.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "style-src 'unsafe-inline'",
  "img-src https://i.ytimg.com https://*.ytimg.com https://*.ggpht.com data:",
  "connect-src https://www.youtube.com https://www.youtube-nocookie.com",
].join("; ")

/**
 * Sandboxed bridge page: YouTube URL stays inside this document (iframe src on our API).
 * Parent controls playback via postMessage — no YouTube UI, links, or native controls.
 */
export function buildYoutubeBridgeHtml(
  videoId: string,
  clientOrigin: string,
  startSeconds = 0
): string {
  const start = Math.max(0, Math.floor(startSeconds))
  const playerVars = new URLSearchParams({
    controls: "0",
    disablekb: "1",
    fs: "0",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    enablejsapi: "1",
    iv_load_policy: "3",
    origin: clientOrigin,
    widget_referrer: clientOrigin,
  })
  if (start > 0) {
    playerVars.set("start", String(start))
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html,body{margin:0;height:100%;overflow:hidden;background:#000}
    #player{border:0;width:100%;height:100%;pointer-events:none}
    .shield{position:fixed;inset:0;z-index:10;background:transparent}
  </style>
</head>
<body>
<div class="shield" aria-hidden="true"></div>
<div id="player"></div>
<script>
(function(){
  var CHANNEL="phynix-video";
  var ORIGIN=${JSON.stringify(clientOrigin)};
  var VIDEO_ID=${JSON.stringify(videoId)};
  var PLAYER_VARS=${JSON.stringify(playerVars.toString())};
  var START=${start};
  var player=null;
  var playing=false;
  var tick=null;

  function emit(msg){
    try{ parent.postMessage(Object.assign({channel:CHANNEL}, msg), ORIGIN); }catch(e){}
  }

  function syncTime(){
    if(!player || typeof player.getCurrentTime!=="function") return;
    try{
      emit({
        type:"time",
        currentTime: player.getCurrentTime() || 0,
        duration: player.getDuration() || 0,
        playing: playing
      });
    }catch(e){}
  }

  function setPlaying(next){
    playing=!!next;
    emit({type:"state", playing: playing});
  }

  window.addEventListener("message", function(e){
    if(e.origin!==ORIGIN) return;
    var d=e.data;
    if(!d || d.channel!==CHANNEL || !player) return;
    try{
      switch(d.cmd){
        case "play": player.playVideo(); setPlaying(true); break;
        case "pause": player.pauseVideo(); setPlaying(false); break;
        case "seek": player.seekTo(d.time||0, true); syncTime(); break;
        case "setSpeed": player.setPlaybackRate(d.rate||1); break;
        case "setVolume":
          player.setVolume(Math.round((d.volume||0)*100));
          if((d.volume||0)>0) player.unMute(); else player.mute();
          break;
        case "mute": player.mute(); break;
        case "unmute": player.unMute(); break;
      }
    }catch(err){}
  });

  function onYouTubeIframeAPIReady(){
    player=new YT.Player("player",{
      videoId: VIDEO_ID,
      playerVars: Object.fromEntries(new URLSearchParams(PLAYER_VARS)),
      events:{
        onReady:function(){
          if(START>0) player.seekTo(START, true);
          emit({
            type:"ready",
            duration: player.getDuration() || 0,
            currentTime: player.getCurrentTime() || START
          });
          syncTime();
          if(tick) clearInterval(tick);
          tick=setInterval(syncTime, 250);
        },
        onStateChange:function(ev){
          var ENDED=YT.PlayerState.ENDED;
          var PAUSED=YT.PlayerState.PAUSED;
          var PLAYING=YT.PlayerState.PLAYING;
          if(ev.data===PLAYING) setPlaying(true);
          else if(ev.data===PAUSED) setPlaying(false);
          else if(ev.data===ENDED){
            setPlaying(false);
            emit({type:"ended", currentTime: player.getCurrentTime() || 0});
          }
          syncTime();
        }
      }
    });
  }

  window.onYouTubeIframeAPIReady=onYouTubeIframeAPIReady;
  var tag=document.createElement("script");
  tag.src="https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
})();
</script>
</body>
</html>`
}
