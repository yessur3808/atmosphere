<!-- Background.svelte -->
<script>
  import { onMount } from "svelte";
  export let background;

  let gradientColors = "";
  let isVideo = false;
  let isImage = false;
  let videoElement; // Declare the videoElement variable outside of any function

  onMount(() => {
    determineBackgroundType();
    setGradientColors();
    setInterval(() => {
      setGradientColors();
    }, 10000);
  });

  function determineBackgroundType() {
    isVideo = false;
    isImage = false;
    if (typeof background === "string") {
      if (background.match(/\.(mp4|webm|ogv|avi|m4v)$/i)) {
        isVideo = true;
      } else if (background.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
        isImage = true;
      }
    }
  }

  // We will use this reactive statement to update the video source
  $: if (videoElement && isVideo) {
    let videoSrc = `assets/videos/${background}`;
    videoElement.src = videoSrc;
    videoElement.load();
  }

  function setGradientColors() {
    // Generate two random colors
    const color1 = getRandomColor();
    const color2 = getRandomColor();
    gradientColors = `linear-gradient(45deg, ${color1}, ${color2})`;
  }

  function getRandomColor() {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  // We use this reactive statement to update the type when background changes
  $: if (background) {
    determineBackgroundType();
  }

  function handleMetadata() {
    videoElement.play();
  }

  $: console.log("background", background);
</script>

<div class="overlay"></div>

{#if isVideo}
  <video
    bind:this={videoElement}
    autoplay
    muted
    loop
    class="video-background"
    on:loadedmetadata={handleMetadata}
  />
{:else if isImage}
  <div
    class="image-background"
    style="background-image: url('assets/images/{background}'); transition: background 2s ease-in-out;"
  ></div>
{:else}
  <div
    class="gradient-background"
    style="background: {gradientColors}; transition: background 2s ease-in-out;"
  ></div>
{/if}

<style>
  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
    background-color: rgba(0, 0, 0, 0.15);
  }

  .video-background,
  .image-background,
  .gradient-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
    transition: background 2s ease-in-out;
  }
</style>
